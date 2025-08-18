/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Human-friendly console output formatting for Entole CLI
 */

import type {
  ChatResponse,
  ChatStreamChunk,
  EmbeddingResponse,
  ModelInfo,
  NormalizedError,
  CapabilityFlags,
} from '../types.js';

/**
 * Format a chat response for human-readable output
 */
export function formatChatResponse(
  response: ChatResponse,
  provider?: string,
  model?: string
): string {
  const lines: string[] = [];

  // Main response text
  lines.push(response.text);

  // Add metadata if available
  if (response.meta || provider || model) {
    lines.push(''); // Empty line separator

    const metaLines: string[] = [];

    if (provider) {
      metaLines.push(`Provider: ${provider}`);
    }

    if (model || response.meta?.model) {
      metaLines.push(`Model: ${model || response.meta?.model}`);
    }

    if (response.meta?.usage) {
      const usage = response.meta.usage;
      const parts: string[] = [];

      if (usage.prompt_tokens) {
        parts.push(`${usage.prompt_tokens} prompt`);
      }
      if (usage.completion_tokens) {
        parts.push(`${usage.completion_tokens} completion`);
      }
      if (usage.total_tokens) {
        parts.push(`${usage.total_tokens} total tokens`);
      }

      if (parts.length > 0) {
        metaLines.push(`Usage: ${parts.join(', ')}`);
      }
    }

    if (response.meta?.finish_reason) {
      metaLines.push(`Finish reason: ${response.meta.finish_reason}`);
    }

    if (metaLines.length > 0) {
      lines.push(`─── ${metaLines.join(' • ')} ───`);
    }
  }

  return lines.join('\n');
}

/**
 * Format an embedding response for human-readable output
 */
export function formatEmbeddingResponse(
  response: EmbeddingResponse,
  provider?: string,
  model?: string
): string {
  const lines: string[] = [];

  // Summary of embeddings
  const vectorCount = response.vectors.length;
  const dimensions = response.vectors[0]?.length || 0;

  lines.push(
    `Generated ${vectorCount} embedding${vectorCount === 1 ? '' : 's'} with ${dimensions} dimensions`
  );

  // Show first few values of first vector as preview
  if (response.vectors.length > 0 && response.vectors[0].length > 0) {
    const firstVector = response.vectors[0];
    const preview = firstVector
      .slice(0, 5)
      .map((v) => v.toFixed(4))
      .join(', ');
    const more = firstVector.length > 5 ? ', ...' : '';
    lines.push(`Preview: [${preview}${more}]`);
  }

  // Add metadata
  const metaLines: string[] = [];

  if (provider) {
    metaLines.push(`Provider: ${provider}`);
  }

  if (model || response.meta?.model) {
    metaLines.push(`Model: ${model || response.meta?.model}`);
  }

  if (response.meta?.usage) {
    const usage = response.meta.usage;
    const parts: string[] = [];

    if (usage.prompt_tokens) {
      parts.push(`${usage.prompt_tokens} prompt`);
    }
    if (usage.total_tokens) {
      parts.push(`${usage.total_tokens} total tokens`);
    }

    if (parts.length > 0) {
      metaLines.push(`Usage: ${parts.join(', ')}`);
    }
  }

  if (metaLines.length > 0) {
    lines.push('');
    lines.push(`─── ${metaLines.join(' • ')} ───`);
  }

  return lines.join('\n');
}

/**
 * Format provider list for human-readable output
 */
export function formatProviderList(
  providers: Array<{
    key: string;
    label: string;
    capabilities: CapabilityFlags;
  }>
): string {
  if (providers.length === 0) {
    return 'No providers available';
  }

  const lines: string[] = [];
  lines.push('Available providers:');
  lines.push('');

  for (const provider of providers) {
    const capabilities: string[] = [];

    if (provider.capabilities.chat) {
      capabilities.push('chat');
    }
    if (provider.capabilities.embeddings) {
      capabilities.push('embeddings');
    }
    if (provider.capabilities.image) {
      capabilities.push('image');
    }
    if (provider.capabilities.tools) {
      capabilities.push('tools');
    }

    const capabilityText =
      capabilities.length > 0
        ? ` (${capabilities.join(', ')})`
        : ' (no capabilities)';

    lines.push(
      `  ${provider.key.padEnd(12)} ${provider.label}${capabilityText}`
    );
  }

  return lines.join('\n');
}

/**
 * Format model list for human-readable output
 */
export function formatModelList(
  models: ModelInfo[],
  provider?: string
): string {
  if (models.length === 0) {
    return provider
      ? `No models available for ${provider}`
      : 'No models available';
  }

  const lines: string[] = [];
  const title = provider
    ? `Available models for ${provider}:`
    : 'Available models:';
  lines.push(title);
  lines.push('');

  for (const model of models) {
    let line = `  ${model.id}`;

    if (model.name && model.name !== model.id) {
      line += ` (${model.name})`;
    }

    if (model.description) {
      line += ` - ${model.description}`;
    }

    lines.push(line);
  }

  return lines.join('\n');
}

/**
 * Format an error for human-readable output
 */
export function formatError(error: NormalizedError): string {
  const lines: string[] = [];

  // Error header with provider context
  lines.push(`❌ Error from ${error.provider}:`);
  lines.push(`   ${error.message}`);

  // Add hint if available
  if (error.hint) {
    lines.push('');
    lines.push(`💡 ${error.hint}`);
  }

  // Add retry information
  if (error.retryable) {
    lines.push('');
    lines.push(
      '🔄 This error is retryable - the operation may succeed if tried again.'
    );
  }

  return lines.join('\n');
}

/**
 * Streaming output handler for chat responses
 */
export class StreamingOutput {
  private buffer = '';
  private isFirstChunk = true;

  /**
   * Process a streaming chunk and output it to console
   */
  processChunk(chunk: ChatStreamChunk): void {
    if (this.isFirstChunk) {
      // Don't add newline before first chunk
      this.isFirstChunk = false;
    }

    if (chunk.delta) {
      process.stdout.write(chunk.delta);
      this.buffer += chunk.delta;
    }

    if (chunk.done) {
      this.finalize(chunk);
    }
  }

  /**
   * Finalize streaming output with metadata
   */
  private finalize(finalChunk: ChatStreamChunk): void {
    // Add newline after content
    process.stdout.write('\n');

    // Show metadata if available
    if (finalChunk.meta) {
      const metaLines: string[] = [];

      if (finalChunk.meta.model) {
        metaLines.push(`Model: ${finalChunk.meta.model}`);
      }

      if (finalChunk.meta.usage) {
        const usage = finalChunk.meta.usage as Record<string, unknown>;
        const parts: string[] = [];

        if (typeof usage.prompt_tokens === 'number') {
          parts.push(`${usage.prompt_tokens} prompt`);
        }
        if (typeof usage.completion_tokens === 'number') {
          parts.push(`${usage.completion_tokens} completion`);
        }
        if (typeof usage.total_tokens === 'number') {
          parts.push(`${usage.total_tokens} total tokens`);
        }

        if (parts.length > 0) {
          metaLines.push(`Usage: ${parts.join(', ')}`);
        }
      }

      if (metaLines.length > 0) {
        process.stdout.write(`\n─── ${metaLines.join(' • ')} ───\n`);
      }
    }
  }

  /**
   * Get the accumulated text content
   */
  getContent(): string {
    return this.buffer;
  }

  /**
   * Handle streaming error
   */
  handleError(error: NormalizedError): void {
    // Add newline if we were in middle of streaming
    if (!this.isFirstChunk) {
      process.stdout.write('\n');
    }

    console.error(formatError(error));
  }
}

/**
 * Format timing information for human output
 */
export function formatTimings(timingsMs?: {
  total: number;
  provider: number;
  config: number;
}): string {
  if (!timingsMs) {
    return '';
  }

  const parts: string[] = [];

  if (timingsMs.total) {
    parts.push(`${timingsMs.total}ms total`);
  }

  if (timingsMs.provider) {
    parts.push(`${timingsMs.provider}ms provider`);
  }

  if (timingsMs.config) {
    parts.push(`${timingsMs.config}ms config`);
  }

  return parts.length > 0 ? `⏱️  ${parts.join(', ')}` : '';
}

/**
 * Format success message with optional metadata
 */
export function formatSuccess(
  message: string,
  metadata?: Record<string, unknown>
): string {
  const lines: string[] = [];
  lines.push(`✅ ${message}`);

  if (metadata && Object.keys(metadata).length > 0) {
    const metaParts: string[] = [];

    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined && value !== null) {
        metaParts.push(`${key}: ${value}`);
      }
    }

    if (metaParts.length > 0) {
      lines.push(`   ${metaParts.join(' • ')}`);
    }
  }

  return lines.join('\n');
}
