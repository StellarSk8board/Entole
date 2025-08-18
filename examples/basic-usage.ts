#!/usr/bin/env node

/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 * 
 * Basic usage examples for Entole CLI library
 */

import {
  loadConfig,
  ProviderRegistry,
  OpenAIAdapter,
  AnthropicAdapter,
  OllamaAdapter,
  withTiming,
  initializeTimings
} from '../src/index.js';

/**
 * Example: Basic chat with OpenAI
 */
async function basicChatExample() {
  console.log('🤖 Basic Chat Example');
  
  // Load configuration
  const { config } = await loadConfig();
  
  // Create and configure provider
  const provider = new OpenAIAdapter(config.providers?.openai);
  
  try {
    const response = await provider.invokeChat({
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'What is the capital of France?' }
      ],
      temperature: 0.7,
      max_tokens: 100
    });
    
    console.log('Response:', response.text);
    console.log('Model:', response.meta?.model);
    console.log('Tokens:', response.meta?.usage?.total_tokens);
  } catch (error) {
    const normalizedError = provider.normalizeError(error);
    console.error('Error:', normalizedError.message);
    if (normalizedError.hint) {
      console.error('Hint:', normalizedError.hint);
    }
  }
}

/**
 * Example: Streaming chat with timing
 */
async function streamingChatExample() {
  console.log('\n🌊 Streaming Chat Example');
  
  // Initialize timing collection
  initializeTimings(true);
  
  const { config } = await loadConfig();
  const provider = new AnthropicAdapter(config.providers?.anthropic);
  
  try {
    const response = await withTiming(
      async () => {
        let fullText = '';
        
        for await (const chunk of provider.invokeChatStream({
          messages: [{ role: 'user', content: 'Tell me a short joke' }],
          max_tokens: 100
        })) {
          if (chunk.delta) {
            process.stdout.write(chunk.delta);
            fullText += chunk.delta;
          }
          
          if (chunk.done) {
            console.log('\n✅ Streaming complete');
            break;
          }
        }
        
        return { text: fullText };
      },
      {
        command: 'chat',
        provider: provider.key,
        model: 'claude-3-5-sonnet-20241022'
      }
    );
    
    console.log('Final response length:', response.text.length);
  } catch (error) {
    console.error('Streaming error:', provider.normalizeError(error));
  }
}

/**
 * Example: Generate embeddings
 */
async function embeddingExample() {
  console.log('\n📊 Embedding Example');
  
  const { config } = await loadConfig();
  const provider = new OpenAIAdapter(config.providers?.openai);
  
  try {
    const response = await provider.invokeEmbeddings({
      input: [
        'The quick brown fox jumps over the lazy dog',
        'Machine learning is a subset of artificial intelligence',
        'TypeScript is a typed superset of JavaScript'
      ],
      model: 'text-embedding-3-small'
    });
    
    console.log(`Generated ${response.vectors.length} embeddings`);
    console.log(`Each embedding has ${response.vectors[0]?.length || 0} dimensions`);
    console.log('Model:', response.meta?.model);
    console.log('Tokens used:', response.meta?.usage?.total_tokens);
  } catch (error) {
    console.error('Embedding error:', provider.normalizeError(error));
  }
}

/**
 * Example: Provider registry usage
 */
async function providerRegistryExample() {
  console.log('\n🔧 Provider Registry Example');
  
  const { config } = await loadConfig();
  const registry = new ProviderRegistry();
  
  // Register providers
  registry.register(new OpenAIAdapter(config.providers?.openai));
  registry.register(new AnthropicAdapter(config.providers?.anthropic));
  registry.register(new OllamaAdapter(config.providers?.ollama));
  
  // List all providers
  console.log('Available providers:');
  for (const info of registry.getProviderInfo()) {
    const capabilities = Object.entries(info.capabilities)
      .filter(([_, supported]) => supported)
      .map(([capability]) => capability)
      .join(', ');
    
    console.log(`  ${info.key}: ${info.label} (${capabilities})`);
  }
  
  // Resolve providers by capability
  try {
    const chatProvider = registry.resolve(undefined, 'chat');
    console.log(`\nDefault chat provider: ${chatProvider.label}`);
    
    const embeddingProvider = registry.resolve(undefined, 'embeddings');
    console.log(`Default embedding provider: ${embeddingProvider.label}`);
  } catch (error) {
    console.error('Provider resolution error:', error.message);
  }
}

/**
 * Example: Configuration loading
 */
async function configurationExample() {
  console.log('\n⚙️ Configuration Example');
  
  try {
    const result = await loadConfig({
      cliFlags: {
        provider: 'openai',
        json: true,
        stream: false
      }
    });
    
    console.log('Configuration sources:');
    console.log('  Environment variables:', result.sources.env);
    console.log('  Config file:', result.sources.file || 'none');
    console.log('  CLI flags:', result.sources.cli);
    
    console.log('\nLoaded configuration:');
    console.log(JSON.stringify(result.config, null, 2));
  } catch (error) {
    console.error('Configuration error:', error.message);
  }
}

/**
 * Run all examples
 */
async function main() {
  console.log('🚀 Entole Library Usage Examples\n');
  
  try {
    await configurationExample();
    await providerRegistryExample();
    
    // Only run provider examples if API keys are available
    if (process.env.OPENAI_API_KEY) {
      await basicChatExample();
      await embeddingExample();
    } else {
      console.log('\n⚠️ Skipping OpenAI examples (no API key)');
    }
    
    if (process.env.ANTHROPIC_API_KEY) {
      await streamingChatExample();
    } else {
      console.log('\n⚠️ Skipping Anthropic examples (no API key)');
    }
    
  } catch (error) {
    console.error('\n❌ Example failed:', error);
    process.exit(1);
  }
  
  console.log('\n✅ All examples completed successfully!');
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}