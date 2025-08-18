/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * JSON envelope output formatting for Entole CLI
 */

import type {
  OutputEnvelope,
  ChatResponse,
  ChatStreamChunk,
  EmbeddingResponse,
  ModelInfo,
  NormalizedError,
  CapabilityFlags,
} from '../types.js';

/**
 * Generate a unique request ID for tracking
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a successful JSON envelope
 */
export function createSuccessEnvelope(
  command: OutputEnvelope['command'],
  data: unknown,
  options: {
    provider?: string;
    model?: string;
    timingsMs?: OutputEnvelope['meta']['timingsMs'];
  } = {}
): OutputEnvelope {
  return {
    ok: true,
    command,
    provider: options.provider,
    model: options.model,
    data,
    meta: {
      requestId: generateRequestId(),
      timingsMs: options.timingsMs,
    },
  };
}

/**
 * Create an error JSON envelope
 */
export function createErrorEnvelope(
  command: OutputEnvelope['command'],
  error: NormalizedError,
  options: {
    provider?: string;
    model?: string;
    timingsMs?: OutputEnvelope['meta']['timingsMs'];
  } = {}
): OutputEnvelope {
  return {
    ok: false,
    command,
    provider: options.provider || error.provider,
    model: options.model,
    data: null,
    meta: {
      requestId: generateRequestId(),
      timingsMs: options.timingsMs,
      error,
    },
  };
}

/**
 * Format chat response as JSON envelope
 */
export function formatChatResponseJson(
  response: ChatResponse,
  provider?: string,
  model?: string,
  timingsMs?: OutputEnvelope['meta']['timingsMs']
): string {
  const envelope = createSuccessEnvelope(
    'chat',
    {
      text: response.text,
      meta: response.meta,
    },
    {
      provider,
      model: model || response.meta?.model,
      timingsMs,
    }
  );

  return JSON.stringify(envelope, null, 2);
}

/**
 * Format embedding response as JSON envelope
 */
export function formatEmbeddingResponseJson(
  response: EmbeddingResponse,
  provider?: string,
  model?: string,
  timingsMs?: OutputEnvelope['meta']['timingsMs']
): string {
  const envelope = createSuccessEnvelope(
    'embed',
    {
      vectors: response.vectors,
      meta: response.meta,
    },
    {
      provider,
      model: model || response.meta?.model,
      timingsMs,
    }
  );

  return JSON.stringify(envelope, null, 2);
}

/**
 * Format provider list as JSON envelope
 */
export function formatProviderListJson(
  providers: Array<{
    key: string;
    label: string;
    capabilities: CapabilityFlags;
  }>,
  timingsMs?: OutputEnvelope['meta']['timingsMs']
): string {
  const data = providers;

  const envelope = createSuccessEnvelope('providers', data, { timingsMs });

  return JSON.stringify(envelope, null, 2);
}

/**
 * Format model list as JSON envelope
 */
export function formatModelListJson(
  models: ModelInfo[],
  provider?: string,
  timingsMs?: OutputEnvelope['meta']['timingsMs']
): string {
  const envelope = createSuccessEnvelope(
    'providers',
    {
      provider,
      models,
    },
    {
      provider,
      timingsMs,
    }
  );

  return JSON.stringify(envelope, null, 2);
}

/**
 * Format error as JSON envelope
 */
export function formatErrorJson(
  command: OutputEnvelope['command'],
  error: NormalizedError,
  provider?: string,
  model?: string,
  timingsMs?: OutputEnvelope['meta']['timingsMs']
): string {
  const envelope = createErrorEnvelope(command, error, {
    provider,
    model,
    timingsMs,
  });

  return JSON.stringify(envelope, null, 2);
}

/**
 * Format config doctor results as JSON envelope
 */
export function formatDoctorResultsJson(
  results: {
    configValid: boolean;
    providers: Array<{
      key: string;
      available: boolean;
      error?: string;
      hint?: string;
    }>;
    issues: string[];
  },
  timingsMs?: OutputEnvelope['meta']['timingsMs']
): string {
  const envelope = createSuccessEnvelope('doctor', results, { timingsMs });

  return JSON.stringify(envelope, null, 2);
}

/**
 * Streaming JSON output handler for chat responses
 */
export class StreamingJsonOutput {
  private chunks: ChatStreamChunk[] = [];
  private provider?: string;
  private model?: string;
  private timingsMs?: OutputEnvelope['meta']['timingsMs'];

  constructor(
    provider?: string,
    model?: string,
    timingsMs?: OutputEnvelope['meta']['timingsMs']
  ) {
    this.provider = provider;
    this.model = model;
    this.timingsMs = timingsMs;
  }

  /**
   * Process a streaming chunk
   */
  processChunk(chunk: ChatStreamChunk): void {
    this.chunks.push(chunk);

    // Output individual chunk as JSON line to stderr for real-time processing
    const chunkEnvelope = {
      type: 'chunk',
      requestId: generateRequestId(),
      chunk: {
        delta: chunk.delta,
        done: chunk.done,
        meta: chunk.meta,
      },
    };

    console.error(JSON.stringify(chunkEnvelope));
  }

  /**
   * Finalize streaming and output complete response
   */
  finalize(): string {
    // Reconstruct full response from chunks
    const fullText = this.chunks
      .filter((chunk) => chunk.delta)
      .map((chunk) => chunk.delta)
      .join('');

    // Get metadata from final chunk
    const finalChunk = this.chunks[this.chunks.length - 1];
    const meta = finalChunk?.meta;

    const response: ChatResponse = {
      text: fullText,
      meta: meta as ChatResponse['meta'],
    };

    return formatChatResponseJson(
      response,
      this.provider,
      this.model,
      this.timingsMs
    );
  }

  /**
   * Handle streaming error
   */
  handleError(error: NormalizedError): string {
    return formatErrorJson(
      'chat',
      error,
      this.provider,
      this.model,
      this.timingsMs
    );
  }
}

/**
 * Log structured message to stderr (for JSON mode)
 */
export function logStructured(
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata?: Record<string, unknown>
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata,
  };

  console.error(JSON.stringify(logEntry));
}

/**
 * Validate and pretty-print JSON envelope
 */
export function validateAndFormatEnvelope(envelope: OutputEnvelope): string {
  // Basic validation
  if (typeof envelope.ok !== 'boolean') {
    throw new Error('Invalid envelope: "ok" field must be boolean');
  }

  if (!['chat', 'embed', 'providers', 'doctor'].includes(envelope.command)) {
    throw new Error(
      'Invalid envelope: "command" field must be one of: chat, embed, providers, doctor'
    );
  }

  if (!envelope.meta || typeof envelope.meta !== 'object') {
    throw new Error(
      'Invalid envelope: "meta" field is required and must be an object'
    );
  }

  // Ensure requestId exists
  if (!envelope.meta.requestId) {
    envelope.meta.requestId = generateRequestId();
  }

  return JSON.stringify(envelope, null, 2);
}

/**
 * Create a minimal success envelope for simple operations
 */
export function createMinimalSuccessEnvelope(
  command: OutputEnvelope['command'],
  message: string,
  metadata?: Record<string, unknown>
): OutputEnvelope {
  return createSuccessEnvelope(command, {
    message,
    ...metadata,
  });
}

/**
 * Redact sensitive information from JSON output
 */
export function redactSensitiveJson(jsonString: string): string {
  // Parse and redact, then re-stringify
  try {
    const obj = JSON.parse(jsonString);
    const redacted = redactSensitiveObject(obj);
    return JSON.stringify(redacted, null, 2);
  } catch {
    // If parsing fails, do basic string redaction
    return jsonString
      .replace(/sk-[a-zA-Z0-9]{48}/g, 'sk-****')
      .replace(/sk-ant-[a-zA-Z0-9-]{95}/g, 'sk-ant-****')
      .replace(/"apiKey":\s*"[^"]+"/g, '"apiKey": "****"')
      .replace(/"api_key":\s*"[^"]+"/g, '"api_key": "****"')
      .replace(/"authorization":\s*"[^"]+"/g, '"authorization": "****"');
  }
}

/**
 * Recursively redact sensitive fields from objects
 */
function redactSensitiveObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveObject);
  }

  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    // Redact sensitive keys
    if (
      lowerKey.includes('key') ||
      lowerKey.includes('token') ||
      lowerKey.includes('auth')
    ) {
      redacted[key] =
        typeof value === 'string' && value.length > 8 ? '****' : value;
    } else {
      redacted[key] = redactSensitiveObject(value);
    }
  }

  return redacted;
}
