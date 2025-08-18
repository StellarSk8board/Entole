/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * OpenAI provider adapter for Chat Completions and Embeddings API
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
 * OpenAI API request/response interfaces
 */
interface OpenAIChatRequest {
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

interface OpenAIChatResponse {
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

interface OpenAIChatStreamChunk {
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

interface OpenAIEmbeddingRequest {
  model: string;
  input: string | string[];
  encoding_format?: 'float' | 'base64';
}

interface OpenAIEmbeddingResponse {
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

interface OpenAIModelsResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
}

/**
 * OpenAI provider adapter configuration
 */
export interface OpenAIConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

/**
 * Known OpenAI models as fallback when API is unavailable
 */
const KNOWN_OPENAI_MODELS: ModelInfo[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Most advanced multimodal model',
    capabilities: { chat: true, embeddings: false, image: true, tools: true },
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast and efficient model for simple tasks',
    capabilities: { chat: true, embeddings: false, image: true, tools: true },
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    description: 'High-intelligence model for complex tasks',
    capabilities: { chat: true, embeddings: false, image: true, tools: true },
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    description: 'Fast and efficient model for most tasks',
    capabilities: { chat: true, embeddings: false, image: false, tools: true },
  },
  {
    id: 'text-embedding-3-large',
    name: 'Text Embedding 3 Large',
    description: 'Most capable embedding model',
    capabilities: { chat: false, embeddings: true, image: false, tools: false },
  },
  {
    id: 'text-embedding-3-small',
    name: 'Text Embedding 3 Small',
    description: 'Efficient embedding model',
    capabilities: { chat: false, embeddings: true, image: false, tools: false },
  },
  {
    id: 'text-embedding-ada-002',
    name: 'Text Embedding Ada 002',
    description: 'Legacy embedding model',
    capabilities: { chat: false, embeddings: true, image: false, tools: false },
  },
];

/**
 * OpenAI provider adapter for Chat Completions and Embeddings API
 */
export class OpenAIAdapter extends BaseProviderAdapter {
  readonly key = 'openai';
  readonly label = 'OpenAI';
  readonly capabilities: CapabilityFlags = {
    chat: true,
    embeddings: true,
    image: true,
    tools: true,
  };

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config: OpenAIConfig = {}) {
    super();

    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.openai.com';
    this.defaultModel = config.defaultModel || 'gpt-4o-mini';
  }

  /**
   * Validate API key is available
   */
  private validateApiKey(): void {
    if (!this.apiKey) {
      throw new Error(
        'OpenAI API key is required. Set OPENAI_API_KEY environment variable or provide apiKey in config.'
      );
    }
  }

  /**
   * Invoke chat completion with OpenAI
   */
  async invokeChat(params: ChatParams): Promise<ChatResponse> {
    this.validateApiKey();
    this.validateRequired(params, ['messages']);

    const model = params.model || this.defaultModel;
    const url = `${this.baseUrl}/v1/chat/completions`;

    const requestBody: OpenAIChatRequest = {
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
        headers: createHeaders(this.apiKey, 'bearer'),
        body: JSON.stringify(requestBody),
      });

      const data = (await response.json()) as OpenAIChatResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No choices returned from OpenAI API');
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
   * Invoke streaming chat completion with OpenAI
   */
  async *invokeChatStream(params: ChatParams): AsyncIterable<ChatStreamChunk> {
    this.validateApiKey();
    this.validateRequired(params, ['messages']);

    const model = params.model || this.defaultModel;
    const url = `${this.baseUrl}/v1/chat/completions`;

    const requestBody: OpenAIChatRequest = {
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
        headers: createHeaders(this.apiKey, 'bearer'),
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
          const chunk = JSON.parse(eventData) as OpenAIChatStreamChunk;

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
   * Invoke embeddings with OpenAI
   */
  async invokeEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse> {
    this.validateApiKey();
    this.validateRequired(params, ['input']);

    const model = params.model || 'text-embedding-3-small';
    const url = `${this.baseUrl}/v1/embeddings`;

    const requestBody: OpenAIEmbeddingRequest = {
      model,
      input: params.input,
      encoding_format: 'float',
    };

    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: createHeaders(this.apiKey, 'bearer'),
        body: JSON.stringify(requestBody),
      });

      const data = (await response.json()) as OpenAIEmbeddingResponse;

      if (!data.data || data.data.length === 0) {
        throw new Error('No embeddings returned from OpenAI API');
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
   * Get available models from OpenAI
   */
  async getModels(): Promise<ModelInfo[]> {
    this.validateApiKey();
    const url = `${this.baseUrl}/v1/models`;

    try {
      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: createHeaders(this.apiKey, 'bearer'),
      });

      const data = (await response.json()) as OpenAIModelsResponse;

      if (!data.data) {
        return KNOWN_OPENAI_MODELS;
      }

      // Convert API response to our ModelInfo format
      const models: ModelInfo[] = data.data.map((model) => {
        // Determine capabilities based on model ID patterns
        const isChat = model.id.includes('gpt') || model.id.includes('chat');
        const isEmbedding =
          model.id.includes('embedding') || model.id.includes('ada');
        const isImage =
          model.id.includes('gpt-4') &&
          !model.id.includes('gpt-4-turbo-preview');
        const hasTools = isChat && !model.id.includes('gpt-3.5-turbo-instruct');

        return {
          id: model.id,
          name: model.id,
          description: `OpenAI ${model.id} model`,
          capabilities: {
            chat: isChat,
            embeddings: isEmbedding,
            image: isImage,
            tools: hasTools,
          },
        };
      });

      return models;
    } catch {
      // If we can't fetch models, return known models as fallback
      return KNOWN_OPENAI_MODELS;
    }
  }

  /**
   * Normalize OpenAI-specific errors
   */
  normalizeError(error: unknown): NormalizedError {
    // Handle OpenAI API error responses
    if (error && typeof error === 'object' && 'httpStatus' in error) {
      const httpError = error as NormalizedError;

      // Add OpenAI-specific hints
      if (httpError.httpStatus === 401) {
        return {
          ...httpError,
          hint: 'Check your OPENAI_API_KEY environment variable. Get your API key from https://platform.openai.com/api-keys',
        };
      }

      if (httpError.httpStatus === 429) {
        return {
          ...httpError,
          hint: 'OpenAI rate limit exceeded. The request will be retried automatically. Consider upgrading your plan for higher limits.',
        };
      }

      if (httpError.httpStatus === 400) {
        return {
          ...httpError,
          hint: 'Check your request parameters. Ensure the model exists and your input is valid.',
        };
      }
    }

    // Use base error normalization for other cases
    return super.normalizeError(error);
  }
}
