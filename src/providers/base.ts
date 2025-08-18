/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Base provider adapter with common functionality and error normalization
 */

import type {
  ProviderAdapter,
  CapabilityFlags,
  ChatParams,
  ChatResponse,
  ChatStreamChunk,
  EmbeddingParams,
  EmbeddingResponse,
  ModelInfo,
  NormalizedError,
} from '../types.js';
import {
  normalizeHttpError,
  normalizeNetworkError,
  createNotImplementedError,
  safeParseJsonResponse,
} from './types.js';

/**
 * Abstract base class for provider adapters
 */
export abstract class BaseProviderAdapter implements ProviderAdapter {
  abstract readonly key: string;
  abstract readonly label: string;
  abstract readonly capabilities: CapabilityFlags;

  /**
   * Default implementation throws not implemented error
   */
  async invokeChat(_params: ChatParams): Promise<ChatResponse> {
    throw this.createNotImplementedError('chat');
  }

  /**
   * Default implementation throws not implemented error
   */
  async *invokeChatStream(_params: ChatParams): AsyncIterable<ChatStreamChunk> {
    // This yield is needed to satisfy TypeScript's generator requirements
    yield { delta: '', done: true };
    throw this.createNotImplementedError('streaming chat');
  }

  /**
   * Default implementation throws not implemented error
   */
  async invokeEmbeddings(_params: EmbeddingParams): Promise<EmbeddingResponse> {
    throw this.createNotImplementedError('embeddings');
  }

  /**
   * Default implementation returns empty array
   */
  async getModels(): Promise<ModelInfo[]> {
    return [];
  }

  /**
   * Normalize errors into our standard format
   */
  normalizeError(error: unknown): NormalizedError {
    // Handle Response objects (fetch API)
    if (error instanceof Response) {
      return normalizeHttpError(error, this.key);
    }

    // Handle fetch errors (network issues)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return normalizeNetworkError(error, this.key);
    }

    // Handle our own normalized errors (pass through)
    if (this.isNormalizedError(error)) {
      return error;
    }

    // Handle generic errors
    if (error instanceof Error) {
      return {
        provider: this.key,
        type: 'internal',
        message: error.message,
        retryable: false,
      };
    }

    // Handle unknown error types
    return {
      provider: this.key,
      type: 'internal',
      message: 'An unknown error occurred',
      retryable: false,
    };
  }

  /**
   * Helper method to make HTTP requests with error handling
   */
  protected async makeRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'entole/1.0.0',
          ...options.headers,
        },
      });

      if (!response.ok) {
        // Parse error body for better error messages
        const body = await safeParseJsonResponse(response);
        throw normalizeHttpError(response, this.key, body);
      }

      return response;
    } catch (error) {
      // Re-throw normalized errors
      if (this.isNormalizedError(error)) {
        throw error;
      }

      // Normalize and throw other errors
      throw this.normalizeError(error);
    }
  }

  /**
   * Helper method to make streaming requests
   */
  protected async makeStreamingRequest(
    url: string,
    options: RequestInit = {}
  ): Promise<ReadableStream<Uint8Array>> {
    const response = await this.makeRequest(url, options);

    if (!response.body) {
      throw new Error('Response body is not available for streaming');
    }

    return response.body;
  }

  /**
   * Helper method to parse Server-Sent Events
   */
  protected async *parseServerSentEvents(
    stream: ReadableStream<Uint8Array>
  ): AsyncIterable<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            yield data;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Helper method to validate required parameters
   */
  protected validateRequired<T>(params: T, requiredFields: (keyof T)[]): void {
    const missing = requiredFields.filter((field) => !params[field]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required parameters: ${missing.map(String).join(', ')}`
      );
    }
  }

  /**
   * Create a not implemented error for this provider
   */
  private createNotImplementedError(feature: string): NormalizedError {
    return createNotImplementedError(this.key, feature);
  }

  /**
   * Type guard to check if an error is already normalized
   */
  private isNormalizedError(error: unknown): error is NormalizedError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'provider' in error &&
      'type' in error &&
      'message' in error &&
      'retryable' in error
    );
  }
}
