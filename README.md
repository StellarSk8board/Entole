# Entole CLI

[![Entole CLI CI](https://github.com/StellarSk8board/Entole/actions/workflows/ci.yml/badge.svg)](https://github.com/StellarSk8board/Entole/actions/workflows/ci.yml)
[![Version](https://img.shields.io/npm/v/entole)](https://www.npmjs.com/package/entole)
[![License](https://img.shields.io/github/license/StellarSk8board/Entole)](https://github.com/StellarSk8board/Entole/blob/main/LICENSE)

Entole is a multi-provider AI CLI for chat and embeddings by Metisse. It provides a unified interface to interact with multiple AI providers including OpenAI, Anthropic, Ollama, and OpenRouter through a simple command-line interface.

## 🚀 Why Entole CLI?

- **🔄 Multi-provider**: Support for OpenAI, Anthropic, Ollama, and OpenRouter
- **🎯 Unified interface**: Single CLI for chat and embeddings across providers
- **⚙️ Flexible configuration**: Environment variables, config files, and CLI flags
- **📊 Built-in observability**: Optional timing collection and structured output
- **💻 Developer-friendly**: JSON output mode for scripting and automation
- **🛡️ Open source**: Apache 2.0 licensed with upstream attribution

## 📦 Installation

### System Requirements

- Node.js version 18 or higher
- macOS, Linux, or Windows

### Install from Source

```bash
# Clone the repository
git clone https://github.com/StellarSk8board/Entole.git
cd entole

# Install dependencies
npm install

# Build the CLI
npm run build

# Install globally
npm install -g .
```

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📋 Key Features

### Multi-Provider Support

- **OpenAI**: GPT-4, GPT-3.5-turbo, and embedding models
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, and other Claude models
- **Ollama**: Local models including Llama 2, Code Llama, and custom models
- **OpenRouter**: Access to multiple providers through a single API

### Command Interface

- **Chat**: Interactive conversations with AI models
- **Embeddings**: Generate vector embeddings for text
- **Provider Management**: List available providers and their capabilities
- **Configuration Doctor**: Validate and troubleshoot configuration

### Configuration & Output

- **Flexible Configuration**: Environment variables, JSON/YAML config files, CLI flags
- **Multiple Output Formats**: Human-friendly text or structured JSON envelopes
- **Streaming Support**: Real-time streaming responses for chat operations
- **Error Handling**: Normalized error responses with helpful hints

## 🔐 Configuration

Entole supports multiple configuration methods with the following precedence (highest to lowest):

1. **Environment Variables** (highest priority)
2. **Configuration Files** (middle priority)  
3. **CLI Flags** (lowest priority)

### Environment Variables

```bash
# Provider API Keys
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENROUTER_API_KEY="sk-or-..."

# Ollama Configuration
export OLLAMA_HOST="http://localhost:11434"
export OLLAMA_MODEL="llama2"

# Default Providers
export ENTOLE_DEFAULT_CHAT_PROVIDER="openai"
export ENTOLE_DEFAULT_EMBEDDINGS_PROVIDER="openai"

# Output Configuration
export ENTOLE_OUTPUT_FORMAT="human"  # or "json"
export ENTOLE_STREAMING="true"

# Observability
export ENTOLE_TIMINGS="false"
```

### Configuration Files

Create `entole.config.json` or `entole.config.yaml` in your project root or `~/.entole/`:

```json
{
  "providers": {
    "default": {
      "chat": "openai",
      "embeddings": "openai"
    },
    "openai": {
      "apiKey": "sk-...",
      "baseUrl": "https://api.openai.com/v1",
      "defaultModel": "gpt-4o-mini"
    },
    "anthropic": {
      "apiKey": "sk-ant-...",
      "defaultModel": "claude-3-5-sonnet-20241022"
    },
    "ollama": {
      "host": "http://localhost:11434",
      "defaultModel": "llama2"
    },
    "openrouter": {
      "apiKey": "sk-or-...",
      "defaultModel": "openai/gpt-4o-mini"
    }
  },
  "output": {
    "format": "human",
    "streaming": true
  },
  "observability": {
    "timings": false
  }
}
```

## 🚀 Getting Started

### Basic Usage

#### Chat with AI models

```bash
# Basic chat
entole chat "Hello, how are you?"

# Use specific provider and model
entole chat "Explain quantum computing" --provider anthropic --model claude-3-5-sonnet-20241022

# Stream response
entole chat "Write a story" --stream

# Read prompt from file
entole chat --file prompt.txt

# JSON output for scripting
entole chat "What is 2+2?" --json
```

#### Generate embeddings

```bash
# Basic embedding
entole embed "Hello world"

# Multiple texts
entole embed "Text 1" "Text 2" "Text 3"

# From file
entole embed @document.txt

# Specific provider
entole embed "Sample text" --provider openai --model text-embedding-3-large
```

#### Provider management

```bash
# List available providers
entole providers list

# Check configuration
entole config doctor
```

### Quick Examples

#### Chat Examples

```bash
# Simple question
entole chat "What is the capital of France?"

# Code generation
entole chat "Write a Python function to calculate fibonacci numbers"

# File-based prompt
echo "Explain this code" > prompt.txt
entole chat --file prompt.txt

# Streaming with specific model
entole chat "Tell me a story" --provider anthropic --stream
```

#### Embedding Examples

```bash
# Single text embedding
entole embed "Machine learning is fascinating"

# Multiple texts
entole embed "First text" "Second text"

# From file
entole embed @README.md

# JSON output for processing
entole embed "Sample text" --json | jq '.data.vectors[0] | length'
```

## 📚 API Documentation

### Command Line Interface

#### `entole chat [prompt]`

Chat with AI models using natural language.

**Arguments:**
- `prompt` (optional) - The text prompt to send to the AI

**Options:**
- `-p, --provider <provider>` - AI provider (openai, anthropic, ollama, openrouter)
- `-m, --model <model>` - Specific model to use
- `-f, --file <file>` - Read prompt from file
- `-s, --stream` - Stream the response in real-time
- `-t, --temperature <temp>` - Temperature for response generation (0.0-2.0)
- `--top-p <top_p>` - Top-p for response generation (0.0-1.0)
- `--max-tokens <tokens>` - Maximum tokens to generate
- `--json` - Output in JSON format

**Examples:**
```bash
entole chat "Hello world"
entole chat --file prompt.txt --provider anthropic --stream
entole chat "Explain AI" --json --max-tokens 100
```

#### `entole embed <input>`

Generate embeddings for text input.

**Arguments:**
- `input` - Text to embed (or @filename to read from file)

**Options:**
- `-p, --provider <provider>` - AI provider to use
- `-m, --model <model>` - Model to use for embeddings
- `--json` - Output in JSON format

**Examples:**
```bash
entole embed "Hello world"
entole embed @document.txt --provider openai
entole embed "Sample text" --json
```

#### `entole providers list`

List available providers and their capabilities.

**Options:**
- `--json` - Output in JSON format

#### `entole config doctor`

Validate configuration and provider setup.

**Options:**
- `--json` - Output results in JSON format

### Library API

Entole can also be used as a Node.js library:

```typescript
import { 
  ProviderRegistry, 
  OpenAIAdapter, 
  AnthropicAdapter,
  loadConfig 
} from 'entole';

// Load configuration
const { config } = await loadConfig();

// Create provider registry
const registry = new ProviderRegistry();
registry.register(new OpenAIAdapter(config.providers?.openai));
registry.register(new AnthropicAdapter(config.providers?.anthropic));

// Use providers
const provider = registry.resolve('openai', 'chat');
const response = await provider.invokeChat({
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response.text);
```

### Core Interfaces

#### `ProviderAdapter`

Base interface that all AI providers implement:

```typescript
interface ProviderAdapter {
  key: string;                    // Provider identifier
  label: string;                  // Human-readable name
  capabilities: CapabilityFlags;  // Supported features

  // Core methods
  invokeChat(params: ChatParams): Promise<ChatResponse>;
  invokeChatStream(params: ChatParams): AsyncIterable<ChatStreamChunk>;
  invokeEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse>;
  getModels(): Promise<ModelInfo[]>;
  normalizeError(error: unknown): NormalizedError;
}
```

#### `ChatParams`

Parameters for chat operations:

```typescript
interface ChatParams {
  model?: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
}
```

#### `ChatResponse`

Response from chat operations:

```typescript
interface ChatResponse {
  text: string;
  meta?: {
    model?: string;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    finish_reason?: string;
  };
}
```

#### `EmbeddingParams`

Parameters for embedding operations:

```typescript
interface EmbeddingParams {
  model?: string;
  input: string | string[];
}
```

#### `EmbeddingResponse`

Response from embedding operations:

```typescript
interface EmbeddingResponse {
  vectors: number[][];
  meta?: {
    model?: string;
    usage?: {
      prompt_tokens?: number;
      total_tokens?: number;
    };
  };
}
```

### Configuration Schema

#### `EntoleConfig`

Main configuration interface:

```typescript
interface EntoleConfig {
  providers?: {
    default?: {
      chat?: string;
      embeddings?: string;
    };
    openai?: {
      apiKey?: string;
      baseUrl?: string;
      defaultModel?: string;
    };
    anthropic?: {
      apiKey?: string;
      defaultModel?: string;
    };
    ollama?: {
      host?: string;
      defaultModel?: string;
    };
    openrouter?: {
      apiKey?: string;
      defaultModel?: string;
    };
  };
  output?: {
    format?: 'human' | 'json';
    streaming?: boolean;
  };
  observability?: {
    timings?: boolean;
  };
}
```

### Output Formats

#### Human Format

Default human-friendly output with colors and formatting:

```
Hello! How can I help you today?

─── Model: gpt-4o-mini • Usage: 10 prompt, 9 completion, 19 total tokens ───
```

#### JSON Format

Structured JSON envelope for programmatic use:

```json
{
  "ok": true,
  "command": "chat",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "data": {
    "text": "Hello! How can I help you today?",
    "meta": {
      "model": "gpt-4o-mini",
      "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 9,
        "total_tokens": 19
      },
      "finish_reason": "stop"
    }
  },
  "meta": {
    "requestId": "req_1703123456789_abc123def",
    "timingsMs": {
      "total": 1500,
      "provider": 1200,
      "config": 50
    }
  }
}
```

### Error Handling

All errors are normalized to a consistent format:

```typescript
interface NormalizedError {
  provider: string;
  type: 'auth' | 'rate_limit' | 'network' | 'bad_request' | 'not_implemented' | 'internal';
  message: string;
  hint?: string;
  httpStatus?: number;
  retryable: boolean;
}
```

Example error output:

```json
{
  "ok": false,
  "command": "chat",
  "data": null,
  "meta": {
    "error": {
      "provider": "openai",
      "type": "auth",
      "message": "Invalid API key",
      "hint": "Check your OPENAI_API_KEY environment variable. Get your API key from https://platform.openai.com/api-keys",
      "httpStatus": 401,
      "retryable": false
    }
  }
}
```

### Usage Examples

See [examples/basic-usage.ts](examples/basic-usage.ts) for comprehensive usage examples including:

- Basic chat operations
- Streaming responses with timing
- Embedding generation
- Provider registry usage
- Configuration loading

Run the examples:

```bash
# Install dependencies and build
npm install && npm run build

# Run examples (requires API keys)
node examples/basic-usage.ts
```

### Exported APIs

When using Entole as a library, the following APIs are available:

#### Core Types
```typescript
import {
  CapabilityFlags,
  ChatParams,
  ChatResponse,
  ChatStreamChunk,
  EmbeddingParams,
  EmbeddingResponse,
  ModelInfo,
  NormalizedError,
  ProviderAdapter,
  OutputEnvelope
} from 'entole';
```

#### Provider System
```typescript
import {
  ProviderRegistry,
  BaseProviderAdapter,
  registerProvider,
  getProvider,
  resolveProvider,
  getProviderInfo
} from 'entole';
```

#### Provider Implementations
```typescript
import {
  OpenAIAdapter,
  AnthropicAdapter,
  OllamaAdapter,
  OpenRouterAdapter,
  MistralAdapter,
  CohereAdapter
} from 'entole';
```

#### Configuration
```typescript
import {
  loadConfig,
  EntoleConfig,
  ConfigValidationError,
  ConfigFileError
} from 'entole';
```

#### Output Formatting
```typescript
import {
  formatChatResponse,
  formatEmbeddingResponse,
  formatProviderList,
  formatError,
  StreamingOutput,
  createSuccessEnvelope,
  createErrorEnvelope,
  getOutputFormat,
  outputContent,
  outputError
} from 'entole';
```

#### Timing and Observability
```typescript
import {
  initializeTimings,
  withTiming,
  closeTimings,
  TimingCollector,
  TimingRecord
} from 'entole';
```

## 🤖 Development Automation (Kiro Agent Hooks)

This project includes Kiro Agent Hooks for automated development workflows. These hooks help maintain code quality and assist with development tasks:

### Available Hooks

#### Automatic Code Quality (on-save-source.yml)

- **Trigger**: When TypeScript files in `src/` are saved
- **Actions**: 
  - Formats the saved file with Prettier
  - Lints the saved file with ESLint
  - Runs related test files if they exist
- **Auto-approved**: Yes (runs automatically)

#### Test File Scaffolding (on-create-test.yml)

- **Trigger**: When new TypeScript files are created in `src/`
- **Actions**: Creates matching `.test.ts` files with basic Vitest structure
- **Auto-approved**: No (requires review)

#### Dependency Tracking (on-save-package.yml)

- **Trigger**: When `package.json` is saved
- **Actions**: 
  - Analyzes dependency changes
  - Fetches release notes for updated packages
  - Updates CHANGELOG.md with dependency changes
- **Auto-approved**: No (requires review)

#### TODO/FIXME Sweep (manual-todo-sweep.yml)

- **Trigger**: Manual button click
- **Actions**: 
  - Scans codebase for TODO and FIXME comments
  - Identifies items added today
  - Categorizes by priority and complexity
  - Generates actionable summary report
- **Auto-approved**: No (requires review)

### Requirements

To use these hooks, you need:

- Kiro IDE with Agent Hooks support
- Node.js 18+ with npm scripts configured
- Git repository for change tracking
- Brave MCP server configured (for dependency tracking)

### Hook Configuration

Hooks are defined in `.kiro/hooks/` and use YAML configuration format. Each hook specifies:

- Trigger conditions (file patterns, manual buttons)
- Execution steps (commands or AI agent prompts)
- Settings (auto-approval, timeouts, etc.)

## 🧪 Testing

Entole includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run integration tests (requires Ollama for some tests)
npm run test:integration

# Watch mode for development
npm run test:watch
```

### Integration Tests

Some integration tests require external services:

- **Ollama tests**: Require Ollama running at `OLLAMA_HOST` (default: `http://localhost:11434`)
- **Provider tests**: May require API keys for full testing (use environment variables)

Tests will automatically skip if required services are unavailable.

## 🤝 Contributing

We welcome contributions! Entole is fully open source (Apache 2.0), and we encourage the community to:

- Report bugs and suggest features
- Improve documentation
- Submit code improvements
- Add new provider adapters

See our [Contributing Guide](./CONTRIBUTING.md) for development setup, coding standards, and how to submit pull requests.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and add tests
4. Run the test suite: `npm test`
5. Run linting: `npm run lint`
6. Format code: `npm run format`
7. Submit a pull request

### Adding New Providers

To add a new AI provider:

1. Create a new adapter class extending `BaseProviderAdapter`
2. Implement all required methods (`invokeChat`, `invokeEmbeddings`, etc.)
3. Add comprehensive tests
4. Register the provider in `src/providers/index.ts`
5. Update documentation

## 📖 Resources

- **[GitHub Repository](https://github.com/StellarSk8board/Entole)** - Source code and issues
- **[NPM Package](https://www.npmjs.com/package/entole)** - Package registry
- **[GitHub Issues](https://github.com/StellarSk8board/Entole/issues)** - Report bugs or request features
- **[Security Advisories](https://github.com/StellarSk8board/Entole/security/advisories)** - Security updates

## 📄 Legal

- **License**: [Apache License 2.0](LICENSE)
- **Attribution**: This project contains substantial changes by Metisse to the original work by Google LLC
- **Security**: [Security Policy](SECURITY.md)

### Upstream Attribution

This project is based on the Gemini CLI by Google LLC, with substantial modifications by Metisse. The original work is licensed under the Apache License 2.0. See [NOTICE](NOTICE) for full attribution details.

---

<p align="center">
  Built with ❤️ by Metisse
</p>
