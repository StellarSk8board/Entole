/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Test suite for provider adapter types and utilities
 *
 * This test file validates the utility functions and interfaces defined in types.ts,
 * ensuring proper error normalization, configuration validation, response parsing,
 * and header creation for provider adapters across the Entole CLI system.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  normalizeHttpError,
  normalizeNetworkError,
  createNotImplementedError,
  validateRequiredConfig,
  safeParseJsonResponse,
  createHeaders,
  type BaseProviderConfig,
  type HttpErrorResponse,
} from './types.js';

describe('Provider Types and Utilities', () => {
  describe('normalizeHttpError', () => {
    it('should normalize 401 authentication errors', () => {
      const response: HttpErrorResponse = {
        status: 401,
        statusText: 'Unauthorized',
        url: 'https://api.example.com/v1/chat',
      };

      const result = normalizeHttpError(response, 'openai');

      expect(result).toEqual({
        provider: 'openai',
        type: 'auth',
        message: 'HTTP 401: Unauthorized',
        hint: 'Check your OPENAI_API_KEY environment variable',
        httpStatus: 401,
        retryable: false,
      });
    });

    it('should normalize 429 rate limit errors as retryable', () => {
      const response: HttpErrorResponse = {
        status: 429,
        statusText: 'Too Many Requests',
        url: 'https://api.anthropic.com/v1/messages',
      };

      const result = normalizeHttpError(response, 'anthropic');

      expect(result).toEqual({
        provider: 'anthropic',
        type: 'rate_limit',
        message: 'HTTP 429: Too Many Requests',
        hint: 'Rate limit exceeded. The request will be retried automatically.',
        httpStatus: 429,
        retryable: true,
      });
    });

    it('should normalize 500+ server errors as retryable', () => {
      const response: HttpErrorResponse = {
        status: 503,
        statusText: 'Service Unavailable',
        url: 'https://api.openrouter.ai/api/v1/chat',
      };

      const result = normalizeHttpError(response, 'openrouter');

      expect(result).toEqual({
        provider: 'openrouter',
        type: 'internal',
        message: 'HTTP 503: Service Unavailable',
        hint: 'Server error. The request will be retried automatically.',
        httpStatus: 503,
        retryable: true,
      });
    });

    it('should normalize 400-499 client errors as bad requests', () => {
      const response: HttpErrorResponse = {
        status: 400,
        statusText: 'Bad Request',
        url: 'https://localhost:11434/api/chat',
      };

      const result = normalizeHttpError(response, 'ollama');

      expect(result).toEqual({
        provider: 'ollama',
        type: 'bad_request',
        message: 'HTTP 400: Bad Request',
        hint: 'Check your request parameters and model availability',
        httpStatus: 400,
        retryable: false,
      });
    });

    it('should extract error message from response body with nested error object', () => {
      const response: HttpErrorResponse = {
        status: 400,
        statusText: 'Bad Request',
        url: 'https://api.openai.com/v1/chat/completions',
      };

      const body = {
        error: {
          message: 'Invalid model specified',
          type: 'invalid_request_error',
        },
      };

      const result = normalizeHttpError(response, 'openai', body);

      expect(result.message).toBe('Invalid model specified');
    });

    it('should extract error message from response body with direct message', () => {
      const response: HttpErrorResponse = {
        status: 422,
        statusText: 'Unprocessable Entity',
        url: 'https://api.anthropic.com/v1/messages',
      };

      const body = {
        message: 'Input validation failed',
        details: 'Missing required field: messages',
      };

      const result = normalizeHttpError(response, 'anthropic', body);

      expect(result.message).toBe('Input validation failed');
    });

    it('should handle missing statusText gracefully', () => {
      const response: HttpErrorResponse = {
        status: 404,
        statusText: '',
        url: 'https://api.example.com/v1/models',
      };

      const result = normalizeHttpError(response, 'test');

      expect(result.message).toBe('HTTP 404: Unknown Error');
    });

    it('should handle Response objects from fetch API', () => {
      // Mock Response object
      const mockResponse = {
        status: 401,
        statusText: 'Unauthorized',
        url: 'https://api.openai.com/v1/chat/completions',
      } as Response;

      const result = normalizeHttpError(mockResponse, 'openai');

      expect(result.type).toBe('auth');
      expect(result.httpStatus).toBe(401);
    });
  });

  describe('normalizeNetworkError', () => {
    it('should normalize Error objects', () => {
      const error = new Error('fetch failed');

      const result = normalizeNetworkError(error, 'openai');

      expect(result).toEqual({
        provider: 'openai',
        type: 'network',
        message: 'fetch failed',
        hint: 'Check your internet connection and provider endpoint',
        retryable: true,
      });
    });

    it('should normalize string errors', () => {
      const error = 'Connection timeout';

      const result = normalizeNetworkError(error, 'anthropic');

      expect(result).toEqual({
        provider: 'anthropic',
        type: 'network',
        message: 'Connection timeout',
        hint: 'Check your internet connection and provider endpoint',
        retryable: true,
      });
    });

    it('should handle unknown error types', () => {
      const error = { code: 'ECONNREFUSED' };

      const result = normalizeNetworkError(error, 'ollama');

      expect(result).toEqual({
        provider: 'ollama',
        type: 'network',
        message: 'Network connection failed',
        hint: 'Check your internet connection and provider endpoint',
        retryable: true,
      });
    });
  });

  describe('createNotImplementedError', () => {
    it('should create not implemented errors with proper structure', () => {
      const result = createNotImplementedError('mistral', 'embeddings');

      expect(result).toEqual({
        provider: 'mistral',
        type: 'not_implemented',
        message: 'embeddings is not yet implemented for mistral',
        hint: 'The mistral adapter is a placeholder. Consider using a different provider.',
        retryable: false,
      });
    });

    it('should handle different features and providers', () => {
      const result = createNotImplementedError('cohere', 'chat streaming');

      expect(result).toEqual({
        provider: 'cohere',
        type: 'not_implemented',
        message: 'chat streaming is not yet implemented for cohere',
        hint: 'The cohere adapter is a placeholder. Consider using a different provider.',
        retryable: false,
      });
    });
  });

  describe('validateRequiredConfig', () => {
    it('should pass validation when all required fields are present', () => {
      const config = {
        apiKey: 'sk-test123',
        baseUrl: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4',
      };

      expect(() => {
        validateRequiredConfig(config, ['apiKey'], 'openai');
      }).not.toThrow();
    });

    it('should throw error when required fields are missing', () => {
      const config = {
        baseUrl: 'https://api.openai.com/v1',
        defaultModel: 'gpt-4',
      };

      expect(() => {
        validateRequiredConfig(config, ['apiKey'], 'openai');
      }).toThrow('Missing required configuration for openai: apiKey');
    });

    it('should throw error with multiple missing fields', () => {
      const config = {
        defaultModel: 'gpt-4',
      };

      expect(() => {
        validateRequiredConfig(config, ['apiKey', 'baseUrl'], 'openai');
      }).toThrow('Missing required configuration for openai: apiKey, baseUrl');
    });

    it('should handle empty config object', () => {
      const config = {};

      expect(() => {
        validateRequiredConfig(config, ['apiKey', 'host'], 'ollama');
      }).toThrow('Missing required configuration for ollama: apiKey, host');
    });

    it('should pass when no fields are required', () => {
      const config = { optional: 'value' };

      expect(() => {
        validateRequiredConfig(config, [], 'test');
      }).not.toThrow();
    });
  });

  describe('safeParseJsonResponse', () => {
    it('should parse valid JSON response', async () => {
      const mockResponse = {
        text: vi
          .fn()
          .mockResolvedValue('{"message": "success", "data": [1, 2, 3]}'),
      } as unknown as Response;

      const result = await safeParseJsonResponse(mockResponse);

      expect(result).toEqual({
        message: 'success',
        data: [1, 2, 3],
      });
    });

    it('should return null for empty response', async () => {
      const mockResponse = {
        text: vi.fn().mockResolvedValue(''),
      } as unknown as Response;

      const result = await safeParseJsonResponse(mockResponse);

      expect(result).toBeNull();
    });

    it('should return null for whitespace-only response', async () => {
      const mockResponse = {
        text: vi.fn().mockResolvedValue('   \n\t  '),
      } as unknown as Response;

      const result = await safeParseJsonResponse(mockResponse);

      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      const mockResponse = {
        text: vi.fn().mockResolvedValue('{ invalid json }'),
      } as unknown as Response;

      const result = await safeParseJsonResponse(mockResponse);

      expect(result).toBeNull();
    });

    it('should return null when text() throws', async () => {
      const mockResponse = {
        text: vi.fn().mockRejectedValue(new Error('Stream already consumed')),
      } as unknown as Response;

      const result = await safeParseJsonResponse(mockResponse);

      expect(result).toBeNull();
    });
  });

  describe('createHeaders', () => {
    it('should create bearer token headers by default', () => {
      const headers = createHeaders('sk-test123');

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'User-Agent': 'entole/1.0.0',
        Authorization: 'Bearer sk-test123',
      });
    });

    it('should create API key headers when specified', () => {
      const headers = createHeaders('sk-ant-test456', 'api-key');

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'User-Agent': 'entole/1.0.0',
        'X-API-Key': 'sk-ant-test456',
      });
    });

    it('should create custom headers without auth when specified', () => {
      const headers = createHeaders('ignored-key', 'custom');

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'User-Agent': 'entole/1.0.0',
      });
    });

    it('should merge custom headers', () => {
      const customHeaders = {
        'HTTP-Referer': 'https://entole.metisse.ai',
        'X-Title': 'Entole CLI',
      };

      const headers = createHeaders('sk-or-test789', 'bearer', customHeaders);

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'User-Agent': 'entole/1.0.0',
        Authorization: 'Bearer sk-or-test789',
        'HTTP-Referer': 'https://entole.metisse.ai',
        'X-Title': 'Entole CLI',
      });
    });

    it('should allow custom headers to override defaults', () => {
      const customHeaders = {
        'Content-Type': 'application/x-ndjson',
        'User-Agent': 'custom-agent/2.0.0',
      };

      const headers = createHeaders('sk-test', 'bearer', customHeaders);

      expect(headers['Content-Type']).toBe('application/x-ndjson');
      expect(headers['User-Agent']).toBe('custom-agent/2.0.0');
      expect(headers['Authorization']).toBe('Bearer sk-test');
    });
  });

  describe('TypeScript Interfaces', () => {
    it('should define BaseProviderConfig interface correctly', () => {
      const config: BaseProviderConfig = {
        apiKey: 'sk-test123',
        baseUrl: 'https://api.example.com/v1',
        defaultModel: 'test-model',
      };

      expect(config.apiKey).toBe('sk-test123');
      expect(config.baseUrl).toBe('https://api.example.com/v1');
      expect(config.defaultModel).toBe('test-model');
    });

    it('should allow partial BaseProviderConfig', () => {
      const config: BaseProviderConfig = {
        apiKey: 'sk-test123',
      };

      expect(config.apiKey).toBe('sk-test123');
      expect(config.baseUrl).toBeUndefined();
      expect(config.defaultModel).toBeUndefined();
    });

    it('should define HttpErrorResponse interface correctly', () => {
      const response: HttpErrorResponse = {
        status: 404,
        statusText: 'Not Found',
        url: 'https://api.example.com/v1/models',
        body: { error: 'Model not found' },
      };

      expect(response.status).toBe(404);
      expect(response.statusText).toBe('Not Found');
      expect(response.url).toBe('https://api.example.com/v1/models');
      expect(response.body).toEqual({ error: 'Model not found' });
    });
  });
});
