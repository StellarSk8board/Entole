/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * OpenRouter provider adapter that proxies to OpenAI-compatible endpoints
 */

import type {
  CapabilityFlags,
  ChatParams,
  ChatResponse,
  ChatStreamChunk,
  EmbeddingParams,
  EmbeddingResponse,
  ModelInfo,
  NormalizedError,
} from '../types.js';
import { BaseProviderAdapter } from './base.js';
import {
  createHeaders,
  normalizeHttpError,
  safeParseJsonResponse,
} from './types.js';

/**
 * OpenRouter API request/response interfaces (OpenAI-compatible)
 */
interface OpenRouterChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface OpenRouterChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterChatStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

interface OpenRouterEmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
}

interface OpenRouterEmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterModelsResponse {
  data: Array<{
    id: string;
    name?: string;
    description?: string;
    context_length?: number;
    pricing?: {
      prompt: string;
      completion: string;
    };
    top_provider?: {
      context_length?: number;
      max_completion_tokens?: number;
    };
  }>;
}

/**
 * OpenRouter provider adapter configuration
 */
export interface OpenRouterConfig {
  apiKey?: string;
  defaultModel?: string;
}

/**
 * OpenRouter provider adapter that proxies to OpenAI-compatible endpoints
 */
export class OpenRouterAdapter extends BaseProviderAdapter {
  readonly key = 'openrouter';
  readonly label = 'OpenRouter';
  readonly capabilities: CapabilityFlags = {
    chat: true,
    embeddings: true,
    image: false, // Depends on underlying model
    tools: false, // Depends on underlying model
  };

  private readonly apiKey: string;
  private readonly baseUrl = 'https://openrouter.ai/api';
  private readonly defaultModel: string;

  constructor(config: OpenRouterConfig = {}) {
    super();

    this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || '';
    this.defaultModel = config.defaultModel || 'openai/gpt-3.5-turbo';
  }

  /**
   * Validate API key is available
   */
  private validateApiKey(): void {
    if (!this.apiKey) {
      throw new Error(
        'OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable or provide apiKey in config.'
      );
    }
  }

  /**
   * Create OpenRouter-specific headers with required HTTP-Referer and X-Title
   */
  private createOpenRouterHeaders(): Record<string, string> {
    return createHeaders(this.apiKey, 'bearer', {
      'HTTP-Referer': 'https://github.com/metisse-ai/entole',
      'X-Title': 'Entole CLI',
    });
  }

  /**
   * Invoke chat completion through OpenRouter proxy
   */
  async invokeChat(params: ChatParams): Promise<ChatResponse> {
    this.validateApiKey();
    this.validateRequired(params, ['messages']);

    const model = params.model || this.defaultModel;
    const url = `${this.baseUrl}/v1/chat/completions`;

    const requestBody: OpenRouterChatRequest = {
      model,
      messages: params.messages,
      temperature: params.temperature,
      top_p: params.top_p,
      max_tokens: params.max_tokens,
      stream: false,
    };

    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: this.createOpenRouterHeaders(),
        body: JSON.stringify(requestBody),
      });

      const data = (await response.json()) as OpenRouterChatResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No choices returned from OpenRouter API');
      }

      const choice = data.choices[0];

      return {
        text: choice.message.content || '',
        meta: {
          model: data.model,
          usage: data.usage,
          finish_reason: choice.finish_reason || undefined,
        },
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Invoke streaming chat completion through OpenRouter proxy
   */
  async *invokeChatStream(params: ChatParams): AsyncIterable<ChatStreamChunk> {
    this.validateApiKey();
    this.validateRequired(params, ['messages']);

    const model = params.model || this.defaultModel;
    const url = `${this.baseUrl}/v1/chat/completions`;

    const requestBody: OpenRouterChatRequest = {
      model,
      messages: params.messages,
      temperature: params.temperature,
      top_p: params.top_p,
      max_tokens: params.max_tokens,
      stream: true,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.createOpenRouterHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const body = await safeParseJsonResponse(response);
        throw normalizeHttpError(response, this.key, body);
      }

      if (!response.body) {
        throw new Error('Response body is not available for streaming');
      }

      // Parse Server-Sent Events
      for await (const eventData of this.parseServerSentEvents(response.body)) {
        try {
          const chunk = JSON.parse(eventData) as OpenRouterChatStreamChunk;

          if (chunk.choices && chunk.choices.length > 0) {
            const choice = chunk.choices[0];
            const content = choice.delta.content;

            if (content) {
              yield {
                delta: content,
                done: choice.finish_reason !== null,
                meta: {
                  model: chunk.model,
                  finish_reason: choice.finish_reason || undefined,
                },
              };
            }

            // Check if streaming is complete
            if (choice.finish_reason !== null) {
              return;
            }
          }
        } catch {
          // Skip malformed JSON chunks
          continue;
        }
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Invoke embeddings through OpenRouter proxy
   */
  async invokeEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse> {
    this.validateApiKey();
    this.validateRequired(params, ['input']);

    const model = params.model || 'text-embedding-ada-002';
    const url = `${this.baseUrl}/v1/embeddings`;

    const requestBody: OpenRouterEmbeddingRequest = {
      model,
      input: params.input,
      encoding_format: 'float',
    };

    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: this.createOpenRouterHeaders(),
        body: JSON.stringify(requestBody),
      });

      const data = (await response.json()) as OpenRouterEmbeddingResponse;

      if (!data.data || data.data.length === 0) {
        throw new Error('No embeddings returned from OpenRouter API');
      }

      // Sort by index to maintain order
      const sortedData = data.data.sort((a, b) => a.index - b.index);
      const vectors = sortedData.map((item) => item.embedding);

      return {
        vectors,
        meta: {
          model: data.model,
          usage: data.usage,
        },
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Get available models from OpenRouter API
   */
  async getModels(): Promise<ModelInfo[]> {
    this.validateApiKey();
    const url = `${this.baseUrl}/v1/models`;

    try {
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: this.createOpenRouterHeaders(),
      });

      const data = (await response.json()) as OpenRouterModelsResponse;

      if (!data.data) {
        return [];
      }

      // Convert API response to our ModelInfo format
      const models: ModelInfo[] = data.data.map((model) => {
        // Determine capabilities based on model ID patterns
        const isChat =
          !model.id.includes('embedding') && !model.id.includes('whisper');
        const isEmbedding = model.id.includes('embedding');
        const isImage =
          model.id.includes('vision') ||
          model.id.includes('gpt-4') ||
          model.id.includes('claude-3');
        const hasTools =
          isChat &&
          (model.id.includes('gpt-4') ||
            model.id.includes('gpt-3.5-turbo') ||
            model.id.includes('claude-3'));

        return {
          id: model.id,
          name: model.name || model.id,
          description: model.description || `OpenRouter ${model.id} model`,
          capabilities: {
            chat: isChat,
            embeddings: isEmbedding,
            image: isImage,
            tools: hasTools,
          },
        };
      });

      return models;
    } catch (error) {
      // If we can't fetch models, return empty array
      // OpenRouter requires API key for model listing
      throw this.normalizeError(error);
    }
  }

  /**
   * Normalize OpenRouter-specific errors
   */
  normalizeError(error: unknown): NormalizedError {
    // Handle OpenRouter API error responses
    if (error && typeof error === 'object' && 'httpStatus' in error) {
      const httpError = error as NormalizedError;

      // Add OpenRouter-specific hints
      if (httpError.httpStatus === 401) {
        return {
          ...httpError,
          hint: 'Check your OPENROUTER_API_KEY environment variable. Get your API key from https://openrouter.ai/keys',
        };
      }

      if (httpError.httpStatus === 429) {
        return {
          ...httpError,
          hint: 'OpenRouter rate limit exceeded. The request will be retried automatically. Consider upgrading your plan for higher limits.',
        };
      }

      if (httpError.httpStatus === 400) {
        return {
          ...httpError,
          hint: 'Check your request parameters. Ensure the model exists and is available through OpenRouter.',
        };
      }

      if (httpError.httpStatus === 402) {
        return {
          ...httpError,
          type: 'auth',
          hint: 'Insufficient credits in your OpenRouter account. Add credits at https://openrouter.ai/credits',
        };
      }
    }

    // Use base error normalization for other cases
    return super.normalizeError(error);
  }
}
