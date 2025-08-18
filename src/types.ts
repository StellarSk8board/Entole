/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Core TypeScript interfaces and types for Entole CLI
 */

/**
 * Capability flags indicating what features a provider supports
 *
 * @example
 * ```typescript
 * const capabilities: CapabilityFlags = {
 *   chat: true,
 *   embeddings: true,
 *   image: false,
 *   tools: false
 * };
 * ```
 */
export interface CapabilityFlags {
  /** Whether the provider supports chat/completion operations */
  chat: boolean;
  /** Whether the provider supports embedding generation */
  embeddings: boolean;
  /** Whether the provider supports image processing (reserved for future use) */
  image: boolean;
  /** Whether the provider supports function/tool calling (reserved for future use) */
  tools: boolean;
}

/**
 * Parameters for chat operations
 *
 * @example
 * ```typescript
 * const params: ChatParams = {
 *   model: 'gpt-4o-mini',
 *   messages: [
 *     { role: 'system', content: 'You are a helpful assistant' },
 *     { role: 'user', content: 'Hello!' }
 *   ],
 *   temperature: 0.7,
 *   max_tokens: 1000
 * };
 * ```
 */
export interface ChatParams {
  /** Model identifier (optional, uses provider default if not specified) */
  model?: string;
  /** Array of conversation messages */
  messages: Array<{
    /** Role of the message sender */
    role: 'system' | 'user' | 'assistant';
    /** Content of the message */
    content: string;
  }>;
  /** Sampling temperature (0.0 to 2.0, higher values make output more random) */
  temperature?: number;
  /** Top-p sampling parameter (0.0 to 1.0, alternative to temperature) */
  top_p?: number;
  /** Maximum number of tokens to generate */
  max_tokens?: number;
}

/**
 * Response from chat operations
 *
 * @example
 * ```typescript
 * const response: ChatResponse = {
 *   text: 'Hello! How can I help you today?',
 *   meta: {
 *     model: 'gpt-4o-mini',
 *     usage: {
 *       prompt_tokens: 10,
 *       completion_tokens: 9,
 *       total_tokens: 19
 *     },
 *     finish_reason: 'stop'
 *   }
 * };
 * ```
 */
export interface ChatResponse {
  /** The generated text response */
  text: string;
  /** Optional metadata about the response */
  meta?: {
    /** Model that generated the response */
    model?: string;
    /** Token usage information */
    usage?: {
      /** Number of tokens in the prompt */
      prompt_tokens?: number;
      /** Number of tokens in the completion */
      completion_tokens?: number;
      /** Total number of tokens used */
      total_tokens?: number;
    };
    /** Reason why the generation finished */
    finish_reason?: string;
  };
}

/**
 * Streaming chunk from chat operations
 */
export interface ChatStreamChunk {
  delta: string;
  done?: boolean;
  meta?: Record<string, unknown>;
}

/**
 * Parameters for embedding operations
 */
export interface EmbeddingParams {
  model?: string;
  input: string | string[];
}

/**
 * Response from embedding operations
 */
export interface EmbeddingResponse {
  vectors: number[][];
  meta?: {
    model?: string;
    usage?: {
      prompt_tokens?: number;
      total_tokens?: number;
    };
  };
}

/**
 * Model information returned by providers
 */
export interface ModelInfo {
  id: string;
  name?: string;
  description?: string;
  capabilities?: CapabilityFlags;
}

/**
 * Normalized error interface for consistent error handling across providers
 */
export interface NormalizedError {
  provider: string;
  type:
    | 'auth'
    | 'rate_limit'
    | 'network'
    | 'bad_request'
    | 'not_implemented'
    | 'internal';
  message: string;
  hint?: string;
  httpStatus?: number;
  retryable: boolean;
}

/**
 * Core provider adapter interface that all providers must implement
 *
 * @example
 * ```typescript
 * class MyProviderAdapter implements ProviderAdapter {
 *   readonly key = 'myprovider';
 *   readonly label = 'My Provider';
 *   readonly capabilities = { chat: true, embeddings: false, image: false, tools: false };
 *
 *   async invokeChat(params: ChatParams): Promise<ChatResponse> {
 *     // Implementation here
 *   }
 *
 *   // ... other required methods
 * }
 * ```
 */
export interface ProviderAdapter {
  /** Unique identifier for the provider (e.g., "openai", "anthropic") */
  readonly key: string;
  /** Human-readable name for the provider (e.g., "OpenAI", "Anthropic") */
  readonly label: string;
  /** Capabilities supported by this provider */
  readonly capabilities: CapabilityFlags;

  /**
   * Invoke a chat completion
   * @param params - Chat parameters including messages and options
   * @returns Promise resolving to the chat response
   */
  invokeChat(params: ChatParams): Promise<ChatResponse>;

  /**
   * Invoke a streaming chat completion
   * @param params - Chat parameters including messages and options
   * @returns Async iterable of chat stream chunks
   */
  invokeChatStream(params: ChatParams): AsyncIterable<ChatStreamChunk>;

  /**
   * Generate embeddings for text input
   * @param params - Embedding parameters including input text
   * @returns Promise resolving to the embedding response
   */
  invokeEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse>;

  /**
   * Get available models from this provider
   * @returns Promise resolving to array of model information
   */
  getModels(): Promise<ModelInfo[]>;

  /**
   * Normalize an error into the standard format
   * @param error - Raw error from the provider
   * @returns Normalized error with consistent structure
   */
  normalizeError(error: unknown): NormalizedError;
}

/**
 * JSON output envelope for structured responses
 */
export interface OutputEnvelope {
  ok: boolean;
  command: 'chat' | 'embed' | 'providers' | 'doctor';
  provider?: string;
  model?: string;
  data: unknown;
  meta: {
    requestId?: string;
    timingsMs?: {
      total: number;
      provider: number;
      config: number;
    };
    error?: NormalizedError;
  };
}
