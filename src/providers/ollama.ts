/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Ollama provider adapter for local AI model integration
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
import { normalizeHttpError, safeParseJsonResponse } from './types.js';

/**
 * Ollama API response interfaces
 */
interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaEmbeddingRequest {
  model: string;
  prompt: string;
}

interface OllamaEmbeddingResponse {
  embedding: number[];
}

interface OllamaTagsResponse {
  models: Array<{
    name: string;
    modified_at: string;
    size: number;
    digest: string;
    details?: {
      format?: string;
      family?: string;
      families?: string[];
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}

/**
 * Ollama provider adapter configuration
 */
export interface OllamaConfig {
  host?: string;
  defaultModel?: string;
}

/**
 * Ollama provider adapter for local AI model integration
 */
export class OllamaAdapter extends BaseProviderAdapter {
  readonly key = 'ollama';
  readonly label = 'Ollama';
  readonly capabilities: CapabilityFlags = {
    chat: true,
    embeddings: true,
    image: false,
    tools: false,
  };

  private readonly host: string;
  private readonly defaultModel: string;

  constructor(config: OllamaConfig = {}) {
    super();
    this.host =
      config.host || process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.defaultModel =
      config.defaultModel || process.env.OLLAMA_MODEL || 'llama2';
  }

  /**
   * Invoke chat completion with Ollama
   */
  async invokeChat(params: ChatParams): Promise<ChatResponse> {
    this.validateRequired(params, ['messages']);

    const model = params.model || this.defaultModel;
    const url = `${this.host}/api/chat`;

    const requestBody: OllamaChatRequest = {
      model,
      messages: params.messages,
      stream: false,
      options: {
        temperature: params.temperature,
        top_p: params.top_p,
        num_predict: params.max_tokens,
      },
    };

    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = (await response.json()) as OllamaChatResponse;

      return {
        text: data.message.content,
        meta: {
          model: data.model,
          usage: {
            prompt_tokens: data.prompt_eval_count,
            completion_tokens: data.eval_count,
            total_tokens:
              (data.prompt_eval_count || 0) + (data.eval_count || 0),
          },
          finish_reason: data.done ? 'stop' : 'length',
        },
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Invoke streaming chat completion with Ollama
   */
  async *invokeChatStream(params: ChatParams): AsyncIterable<ChatStreamChunk> {
    this.validateRequired(params, ['messages']);

    const model = params.model || this.defaultModel;
    const url = `${this.host}/api/chat`;

    const requestBody: OllamaChatRequest = {
      model,
      messages: params.messages,
      stream: true,
      options: {
        temperature: params.temperature,
        top_p: params.top_p,
        num_predict: params.max_tokens,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'entole/1.0.0',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const body = await safeParseJsonResponse(response);
        throw normalizeHttpError(response, this.key, body);
      }

      if (!response.body) {
        throw new Error('Response body is not available for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter((line) => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line) as OllamaChatResponse;

              if (data.message?.content) {
                yield {
                  delta: data.message.content,
                  done: data.done,
                  meta: {
                    model: data.model,
                  },
                };
              }

              if (data.done) {
                return;
              }
            } catch {
              // Skip malformed JSON lines
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Invoke embeddings with Ollama
   */
  async invokeEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse> {
    this.validateRequired(params, ['input']);

    const model = params.model || this.defaultModel;
    const url = `${this.host}/api/embeddings`;

    // Handle both string and array inputs
    const inputs = Array.isArray(params.input) ? params.input : [params.input];
    const vectors: number[][] = [];

    try {
      for (const input of inputs) {
        const requestBody: OllamaEmbeddingRequest = {
          model,
          prompt: input,
        };

        const response = await this.makeRequest(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const data = (await response.json()) as OllamaEmbeddingResponse;
        vectors.push(data.embedding);
      }

      return {
        vectors,
        meta: {
          model,
          usage: {
            prompt_tokens: inputs.reduce((sum, input) => sum + input.length, 0),
            total_tokens: inputs.reduce((sum, input) => sum + input.length, 0),
          },
        },
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Get available models from Ollama
   */
  async getModels(): Promise<ModelInfo[]> {
    const url = `${this.host}/api/tags`;

    try {
      const response = await this.makeRequest(url);
      const data = (await response.json()) as OllamaTagsResponse;

      return data.models.map((model) => ({
        id: model.name,
        name: model.name,
        description: model.details?.family
          ? `${model.details.family} model`
          : undefined,
        capabilities: {
          chat: true,
          embeddings: true,
          image: false,
          tools: false,
        },
      }));
    } catch {
      // If we can't fetch models, return the default model as fallback
      return [
        {
          id: this.defaultModel,
          name: this.defaultModel,
          description: 'Default Ollama model',
          capabilities: this.capabilities,
        },
      ];
    }
  }

  /**
   * Check if Ollama is available and healthy
   */
  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const url = `${this.host}/api/tags`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'entole/1.0.0',
        },
        // Short timeout for health checks
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return { healthy: true };
      } else {
        return {
          healthy: false,
          error: `Ollama returned HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      let errorMessage = 'Unknown error';

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Connection timeout';
        } else if (error.message.includes('fetch')) {
          errorMessage = 'Connection failed';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        healthy: false,
        error: `Ollama health check failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Normalize Ollama-specific errors
   */
  normalizeError(error: unknown): NormalizedError {
    // Handle fetch errors specifically for Ollama
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        provider: this.key,
        type: 'network',
        message: 'Failed to connect to Ollama',
        hint: `Check that Ollama is running at ${this.host}. You can start it with 'ollama serve'.`,
        retryable: true,
      };
    }

    // Handle HTTP errors with Ollama-specific hints
    if (error && typeof error === 'object' && 'httpStatus' in error) {
      const httpError = error as NormalizedError;

      if (httpError.httpStatus === 404) {
        return {
          ...httpError,
          hint: `Model not found. Check available models with 'ollama list' or pull the model with 'ollama pull ${this.defaultModel}'.`,
        };
      }
    }

    // Use base error normalization for other cases
    return super.normalizeError(error);
  }
}
