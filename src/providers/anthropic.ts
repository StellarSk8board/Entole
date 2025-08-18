/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Anthropic provider adapter for Messages API
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
 * Anthropic API request/response interfaces
 */
interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicChatRequest {
  model: string;
  max_tokens: number;
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

interface AnthropicChatResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamEvent {
  type:
    | 'message_start'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'message_delta'
    | 'message_stop';
  message?: Partial<AnthropicChatResponse>;
  content_block?: {
    type: 'text';
    text: string;
  };
  delta?: {
    type: 'text_delta';
    text: string;
  };
  usage?: {
    output_tokens: number;
  };
}

/**
 * Anthropic provider adapter configuration
 */
export interface AnthropicConfig {
  apiKey?: string;
  defaultModel?: string;
}

/**
 * Known Anthropic models
 */
const KNOWN_ANTHROPIC_MODELS: ModelInfo[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    description:
      'Most intelligent model with best performance on complex tasks',
    capabilities: { chat: true, embeddings: false, image: true, tools: true },
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    description: 'Fastest model for everyday tasks',
    capabilities: { chat: true, embeddings: false, image: true, tools: true },
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    description: 'Most powerful model for highly complex tasks',
    capabilities: { chat: true, embeddings: false, image: true, tools: true },
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    description: 'Balance of intelligence and speed',
    capabilities: { chat: true, embeddings: false, image: true, tools: true },
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    description: 'Fast and cost-effective model',
    capabilities: { chat: true, embeddings: false, image: true, tools: true },
  },
];

/**
 * Anthropic provider adapter for Messages API
 */
export class AnthropicAdapter extends BaseProviderAdapter {
  readonly key = 'anthropic';
  readonly label = 'Anthropic';
  readonly capabilities: CapabilityFlags = {
    chat: true,
    embeddings: false, // Anthropic doesn't support embeddings
    image: true,
    tools: true,
  };

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(config: AnthropicConfig = {}) {
    super();

    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl = 'https://api.anthropic.com';
    this.defaultModel = config.defaultModel || 'claude-3-5-sonnet-20241022';
  }

  /**
   * Validate API key is available
   */
  private validateApiKey(): void {
    if (!this.apiKey) {
      throw new Error(
        'Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or provide apiKey in config.'
      );
    }
  }

  /**
   * Invoke chat completion with Anthropic Messages API
   */
  async invokeChat(params: ChatParams): Promise<ChatResponse> {
    this.validateApiKey();
    this.validateRequired(params, ['messages']);

    const model = params.model || this.defaultModel;
    const url = `${this.baseUrl}/v1/messages`;

    // Convert messages format and extract system message
    const { messages, system } = this.convertMessages(params.messages);

    const requestBody: AnthropicChatRequest = {
      model,
      max_tokens: params.max_tokens || 4096,
      messages,
      system,
      temperature: params.temperature,
      top_p: params.top_p,
      stream: false,
    };

    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers: createHeaders(this.apiKey, 'api-key', {
          'anthropic-version': '2023-06-01',
        }),
        body: JSON.stringify(requestBody),
      });

      const data = (await response.json()) as AnthropicChatResponse;

      if (!data.content || data.content.length === 0) {
        throw new Error('No content returned from Anthropic API');
      }

      // Extract text from content blocks
      const text = data.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return {
        text,
        meta: {
          model: data.model,
          usage: {
            prompt_tokens: data.usage.input_tokens,
            completion_tokens: data.usage.output_tokens,
            total_tokens: data.usage.input_tokens + data.usage.output_tokens,
          },
          finish_reason: data.stop_reason || undefined,
        },
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Invoke streaming chat completion with Anthropic Messages API
   */
  async *invokeChatStream(params: ChatParams): AsyncIterable<ChatStreamChunk> {
    this.validateApiKey();
    this.validateRequired(params, ['messages']);

    const model = params.model || this.defaultModel;
    const url = `${this.baseUrl}/v1/messages`;

    // Convert messages format and extract system message
    const { messages, system } = this.convertMessages(params.messages);

    const requestBody: AnthropicChatRequest = {
      model,
      max_tokens: params.max_tokens || 4096,
      messages,
      system,
      temperature: params.temperature,
      top_p: params.top_p,
      stream: true,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: createHeaders(this.apiKey, 'api-key', {
          'anthropic-version': '2023-06-01',
        }),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const body = await safeParseJsonResponse(response);
        throw normalizeHttpError(response, this.key, body);
      }

      if (!response.body) {
        throw new Error('Response body is not available for streaming');
      }

      let currentModel = model;
      let totalOutputTokens = 0;

      // Parse Server-Sent Events
      for await (const eventData of this.parseServerSentEvents(response.body)) {
        try {
          const event = JSON.parse(eventData) as AnthropicStreamEvent;

          switch (event.type) {
            case 'message_start':
              if (event.message?.model) {
                currentModel = event.message.model;
              }
              break;

            case 'content_block_delta':
              if (event.delta?.text) {
                yield {
                  delta: event.delta.text,
                  done: false,
                  meta: {
                    model: currentModel,
                  },
                };
              }
              break;

            case 'message_delta':
              if (event.usage?.output_tokens) {
                totalOutputTokens = event.usage.output_tokens;
              }
              break;

            case 'message_stop':
              yield {
                delta: '',
                done: true,
                meta: {
                  model: currentModel,
                  usage: {
                    completion_tokens: totalOutputTokens,
                  },
                  finish_reason: 'end_turn',
                },
              };
              return;
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
   * Embeddings are not supported by Anthropic
   */
  async invokeEmbeddings(_params: EmbeddingParams): Promise<EmbeddingResponse> {
    throw this.normalizeError({
      provider: this.key,
      type: 'not_implemented',
      message: 'Embeddings are not supported by Anthropic',
      hint: 'Use OpenAI, OpenRouter, or Ollama for embedding capabilities',
      retryable: false,
    });
  }

  /**
   * Get available models from Anthropic (returns known models)
   */
  async getModels(): Promise<ModelInfo[]> {
    // Anthropic doesn't have a public models API endpoint
    // Return our known models list
    return KNOWN_ANTHROPIC_MODELS;
  }

  /**
   * Convert OpenAI-style messages to Anthropic format
   * Anthropic requires alternating user/assistant messages and separate system parameter
   */
  private convertMessages(messages: ChatParams['messages']): {
    messages: AnthropicMessage[];
    system?: string;
  } {
    let system: string | undefined;
    const anthropicMessages: AnthropicMessage[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        // Combine system messages
        system = system ? `${system}\n\n${message.content}` : message.content;
      } else if (message.role === 'user' || message.role === 'assistant') {
        anthropicMessages.push({
          role: message.role,
          content: message.content,
        });
      }
    }

    // Ensure messages start with user message
    if (anthropicMessages.length > 0 && anthropicMessages[0].role !== 'user') {
      anthropicMessages.unshift({
        role: 'user',
        content: 'Hello',
      });
    }

    return { messages: anthropicMessages, system };
  }

  /**
   * Normalize Anthropic-specific errors
   */
  normalizeError(error: unknown): NormalizedError {
    // Handle Anthropic API error responses
    if (error && typeof error === 'object' && 'httpStatus' in error) {
      const httpError = error as NormalizedError;

      // Add Anthropic-specific hints
      if (httpError.httpStatus === 401) {
        return {
          ...httpError,
          hint: 'Check your ANTHROPIC_API_KEY environment variable. Get your API key from https://console.anthropic.com/',
        };
      }

      if (httpError.httpStatus === 429) {
        return {
          ...httpError,
          hint: 'Anthropic rate limit exceeded. The request will be retried automatically. Consider upgrading your plan for higher limits.',
        };
      }

      if (httpError.httpStatus === 400) {
        return {
          ...httpError,
          hint: 'Check your request parameters. Ensure the model exists and your messages follow the correct format.',
        };
      }
    }

    // Use base error normalization for other cases
    return super.normalizeError(error);
  }
}
