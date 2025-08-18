/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Shared types and utilities for provider adapters
 */

import type { NormalizedError } from '../types.js';

/**
 * Base configuration interface that all provider configs extend
 */
export interface BaseProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

/**
 * HTTP response interface for error normalization
 */
export interface HttpErrorResponse {
  status: number;
  statusText: string;
  url: string;
  body?: unknown;
}

/**
 * Utility function to normalize HTTP errors into our standard format
 */
export function normalizeHttpError(
  response: Response | HttpErrorResponse,
  provider: string,
  body?: unknown
): NormalizedError {
  const status = response.status;
  const statusText = response.statusText || 'Unknown Error';

  // Determine error type based on HTTP status
  let type: NormalizedError['type'];
  let retryable = false;
  let hint: string | undefined;

  switch (true) {
    case status === 401:
      type = 'auth';
      hint = `Check your ${provider.toUpperCase()}_API_KEY environment variable`;
      break;
    case status === 429:
      type = 'rate_limit';
      retryable = true;
      hint = 'Rate limit exceeded. The request will be retried automatically.';
      break;
    case status >= 500:
      type = 'internal';
      retryable = true;
      hint = 'Server error. The request will be retried automatically.';
      break;
    case status >= 400:
      type = 'bad_request';
      hint = 'Check your request parameters and model availability';
      break;
    default:
      type = 'network';
      retryable = true;
  }

  // Extract error message from response body if available
  let message = `HTTP ${status}: ${statusText}`;
  if (body && typeof body === 'object' && body !== null) {
    const errorBody = body as Record<string, unknown>;
    if (errorBody.error && typeof errorBody.error === 'object') {
      const error = errorBody.error as Record<string, unknown>;
      if (typeof error.message === 'string') {
        message = error.message;
      }
    } else if (typeof errorBody.message === 'string') {
      message = errorBody.message;
    }
  }

  return {
    provider,
    type,
    message,
    hint,
    httpStatus: status,
    retryable,
  };
}

/**
 * Utility function to normalize network errors
 */
export function normalizeNetworkError(
  error: unknown,
  provider: string
): NormalizedError {
  let message = 'Network connection failed';

  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }

  return {
    provider,
    type: 'network',
    message,
    hint: 'Check your internet connection and provider endpoint',
    retryable: true,
  };
}

/**
 * Utility function to create a "not implemented" error
 */
export function createNotImplementedError(
  provider: string,
  feature: string
): NormalizedError {
  return {
    provider,
    type: 'not_implemented',
    message: `${feature} is not yet implemented for ${provider}`,
    hint: `The ${provider} adapter is a placeholder. Consider using a different provider.`,
    retryable: false,
  };
}

/**
 * Utility function to validate required configuration
 */
export function validateRequiredConfig(
  config: Record<string, unknown>,
  requiredFields: string[],
  provider: string
): void {
  const missing = requiredFields.filter((field) => !config[field]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration for ${provider}: ${missing.join(', ')}`
    );
  }
}

/**
 * Utility function to safely parse JSON response
 */
export async function safeParseJsonResponse(
  response: Response
): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text.trim()) {
      return null;
    }
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Utility function to create fetch headers with common patterns
 */
export function createHeaders(
  apiKey: string,
  authType: 'bearer' | 'api-key' | 'custom' = 'bearer',
  customHeaders: Record<string, string> = {}
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'entole/1.0.0',
    ...customHeaders,
  };

  switch (authType) {
    case 'bearer':
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;
    case 'api-key':
      headers['X-API-Key'] = apiKey;
      break;
    // 'custom' means the caller handles auth headers manually
  }

  return headers;
}
