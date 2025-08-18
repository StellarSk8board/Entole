/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Output formatting module for Entole CLI
 */

// Human-friendly output
export {
  formatChatResponse,
  formatEmbeddingResponse,
  formatProviderList,
  formatModelList,
  formatError,
  formatTimings,
  formatSuccess,
  StreamingOutput,
} from './human.js';

// JSON envelope output
export {
  createSuccessEnvelope,
  createErrorEnvelope,
  formatChatResponseJson,
  formatEmbeddingResponseJson,
  formatProviderListJson,
  formatModelListJson,
  formatErrorJson,
  formatDoctorResultsJson,
  StreamingJsonOutput,
  logStructured,
  validateAndFormatEnvelope,
  createMinimalSuccessEnvelope,
  redactSensitiveJson,
} from './json.js';

// Output format type
export type OutputFormat = 'human' | 'json';

/**
 * Utility function to determine output format from CLI flags
 *
 * @param jsonFlag - Whether JSON output was requested
 * @returns The output format to use
 *
 * @example
 * ```typescript
 * const format = getOutputFormat(options.json);
 * ```
 */
export function getOutputFormat(jsonFlag?: boolean): OutputFormat {
  return jsonFlag ? 'json' : 'human';
}

/**
 * Utility function to output content in the specified format
 *
 * @param content - The content to output
 * @param format - The output format to use
 *
 * @example
 * ```typescript
 * outputContent('Hello world', 'human');
 * outputContent(JSON.stringify(data), 'json');
 * ```
 */
export function outputContent(
  content: string,
  format: OutputFormat = 'human'
): void {
  if (format === 'json') {
    // For JSON mode, output to stdout
    console.log(content);
  } else {
    // For human mode, output to stdout
    console.log(content);
  }
}

/**
 * Utility function to output error in the specified format
 *
 * @param content - The error content to output
 * @param format - The output format to use
 *
 * @example
 * ```typescript
 * outputError('Something went wrong', 'human');
 * outputError(JSON.stringify(errorEnvelope), 'json');
 * ```
 */
export function outputError(
  content: string,
  format: OutputFormat = 'human'
): void {
  if (format === 'json') {
    // For JSON mode, output to stdout (errors are part of the envelope)
    console.log(content);
  } else {
    // For human mode, output to stderr
    console.error(content);
  }
}
