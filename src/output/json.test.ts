/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Unit tests for JSON envelope output formatting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
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
import type {
  ChatResponse,
  EmbeddingResponse,
  ProviderAdapter,
  ModelInfo,
  NormalizedError,
  ChatStreamChunk,
  OutputEnvelope,
} from '../types.js';

describe('createSuccessEnvelope', () => {
  it('should create basic success envelope', () => {
    const envelope = createSuccessEnvelope('chat', { text: 'Hello' });

    expect(envelope.ok).toBe(true);
    expect(envelope.command).toBe('chat');
    expect(envelope.data).toEqual({ text: 'Hello' });
    expect(envelope.meta.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
  });

  it('should include optional metadata', () => {
    const timings = { total: 1000, provider: 800, config: 200 };
    const envelope = createSuccessEnvelope(
      'embed',
      { vectors: [] },
      {
        provider: 'openai',
        model: 'text-embedding-ada-002',
        timingsMs: timings,
      }
    );

    expect(envelope.provider).toBe('openai');
    expect(envelope.model).toBe('text-embedding-ada-002');
    expect(envelope.meta.timingsMs).toEqual(timings);
  });
});

describe('createErrorEnvelope', () => {
  it('should create error envelope', () => {
    const error: NormalizedError = {
      provider: 'openai',
      type: 'auth',
      message: 'Invalid API key',
      retryable: false,
    };

    const envelope = createErrorEnvelope('chat', error);

    expect(envelope.ok).toBe(false);
    expect(envelope.command).toBe('chat');
    expect(envelope.provider).toBe('openai');
    expect(envelope.data).toBe(null);
    expect(envelope.meta.error).toEqual(error);
  });
});

describe('formatChatResponseJson', () => {
  it('should format chat response as JSON', () => {
    const response: ChatResponse = {
      text: 'Hello, world!',
      meta: {
        model: 'gpt-4',
        usage: { total_tokens: 10 },
      },
    };

    const result = formatChatResponseJson(response, 'openai', 'gpt-4');
    const parsed = JSON.parse(result);

    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe('chat');
    expect(parsed.provider).toBe('openai');
    expect(parsed.model).toBe('gpt-4');
    expect(parsed.data.text).toBe('Hello, world!');
    expect(parsed.data.meta.usage.total_tokens).toBe(10);
  });

  it('should handle minimal response', () => {
    const response: ChatResponse = { text: 'Hi' };
    const result = formatChatResponseJson(response);
    const parsed = JSON.parse(result);

    expect(parsed.data.text).toBe('Hi');
    expect(parsed.provider).toBeUndefined();
    expect(parsed.model).toBeUndefined();
  });
});

describe('formatEmbeddingResponseJson', () => {
  it('should format embedding response as JSON', () => {
    const response: EmbeddingResponse = {
      vectors: [[0.1, 0.2, 0.3]],
      meta: {
        model: 'text-embedding-ada-002',
        usage: { total_tokens: 5 },
      },
    };

    const result = formatEmbeddingResponseJson(response, 'openai');
    const parsed = JSON.parse(result);

    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe('embed');
    expect(parsed.provider).toBe('openai');
    expect(parsed.data.vectors).toEqual([[0.1, 0.2, 0.3]]);
    expect(parsed.data.meta.usage.total_tokens).toBe(5);
  });
});

describe('formatProviderListJson', () => {
  it('should format provider list as JSON', () => {
    const providers: ProviderAdapter[] = [
      {
        key: 'openai',
        label: 'OpenAI',
        capabilities: {
          chat: true,
          embeddings: true,
          image: false,
          tools: false,
        },
      } as ProviderAdapter,
      {
        key: 'anthropic',
        label: 'Anthropic',
        capabilities: {
          chat: true,
          embeddings: false,
          image: false,
          tools: false,
        },
      } as ProviderAdapter,
    ];

    const result = formatProviderListJson(providers);
    const parsed = JSON.parse(result);

    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe('providers');
    expect(parsed.data).toHaveLength(2);
    expect(parsed.data[0].key).toBe('openai');
    expect(parsed.data[0].capabilities.chat).toBe(true);
    expect(parsed.data[1].key).toBe('anthropic');
    expect(parsed.data[1].capabilities.embeddings).toBe(false);
  });
});

describe('formatModelListJson', () => {
  it('should format model list as JSON', () => {
    const models: ModelInfo[] = [
      { id: 'gpt-4', name: 'GPT-4', description: 'Most capable' },
      { id: 'gpt-3.5-turbo' },
    ];

    const result = formatModelListJson(models, 'openai');
    const parsed = JSON.parse(result);

    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe('providers');
    expect(parsed.provider).toBe('openai');
    expect(parsed.data.provider).toBe('openai');
    expect(parsed.data.models).toHaveLength(2);
    expect(parsed.data.models[0].id).toBe('gpt-4');
  });
});

describe('formatErrorJson', () => {
  it('should format error as JSON', () => {
    const error: NormalizedError = {
      provider: 'anthropic',
      type: 'rate_limit',
      message: 'Rate limit exceeded',
      hint: 'Wait before retrying',
      retryable: true,
    };

    const result = formatErrorJson('chat', error, 'anthropic', 'claude-3');
    const parsed = JSON.parse(result);

    expect(parsed.ok).toBe(false);
    expect(parsed.command).toBe('chat');
    expect(parsed.provider).toBe('anthropic');
    expect(parsed.model).toBe('claude-3');
    expect(parsed.data).toBe(null);
    expect(parsed.meta.error).toEqual(error);
  });
});

describe('formatDoctorResultsJson', () => {
  it('should format doctor results as JSON', () => {
    const results = {
      configValid: true,
      providers: [
        { key: 'openai', available: true },
        {
          key: 'anthropic',
          available: false,
          error: 'Missing API key',
          hint: 'Set ANTHROPIC_API_KEY',
        },
      ],
      issues: ['Config file not found'],
    };

    const result = formatDoctorResultsJson(results);
    const parsed = JSON.parse(result);

    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe('doctor');
    expect(parsed.data.configValid).toBe(true);
    expect(parsed.data.providers).toHaveLength(2);
    expect(parsed.data.issues).toEqual(['Config file not found']);
  });
});

describe('StreamingJsonOutput', () => {
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsoleError.mockRestore();
  });

  it('should process streaming chunks and output to stderr', () => {
    const streaming = new StreamingJsonOutput('openai', 'gpt-4');

    const chunk1: ChatStreamChunk = { delta: 'Hello', done: false };
    const chunk2: ChatStreamChunk = { delta: ' world', done: true };

    streaming.processChunk(chunk1);
    streaming.processChunk(chunk2);

    expect(mockConsoleError).toHaveBeenCalledTimes(2);

    // Check that chunk envelopes were logged
    const call1 = mockConsoleError.mock.calls[0][0];
    const parsed1 = JSON.parse(call1);
    expect(parsed1.type).toBe('chunk');
    expect(parsed1.chunk.delta).toBe('Hello');
    expect(parsed1.chunk.done).toBe(false);

    const call2 = mockConsoleError.mock.calls[1][0];
    const parsed2 = JSON.parse(call2);
    expect(parsed2.chunk.delta).toBe(' world');
    expect(parsed2.chunk.done).toBe(true);
  });

  it('should finalize streaming output', () => {
    const streaming = new StreamingJsonOutput('openai', 'gpt-4');

    streaming.processChunk({ delta: 'Hello', done: false });
    streaming.processChunk({
      delta: ' world',
      done: true,
      meta: { model: 'gpt-4' },
    });

    const result = streaming.finalize();
    const parsed = JSON.parse(result);

    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe('chat');
    expect(parsed.provider).toBe('openai');
    expect(parsed.model).toBe('gpt-4');
    expect(parsed.data.text).toBe('Hello world');
    expect(parsed.data.meta.model).toBe('gpt-4');
  });

  it('should handle streaming errors', () => {
    const streaming = new StreamingJsonOutput('openai');

    const error: NormalizedError = {
      provider: 'openai',
      type: 'network',
      message: 'Connection failed',
      retryable: true,
    };

    const result = streaming.handleError(error);
    const parsed = JSON.parse(result);

    expect(parsed.ok).toBe(false);
    expect(parsed.command).toBe('chat');
    expect(parsed.meta.error).toEqual(error);
  });
});

describe('logStructured', () => {
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsoleError.mockRestore();
  });

  it('should log structured messages to stderr', () => {
    logStructured('info', 'Test message', { key: 'value' });

    expect(mockConsoleError).toHaveBeenCalledTimes(1);

    const loggedData = JSON.parse(mockConsoleError.mock.calls[0][0]);
    expect(loggedData.level).toBe('info');
    expect(loggedData.message).toBe('Test message');
    expect(loggedData.key).toBe('value');
    expect(loggedData.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    );
  });
});

describe('validateAndFormatEnvelope', () => {
  it('should validate and format valid envelope', () => {
    const envelope: OutputEnvelope = {
      ok: true,
      command: 'chat',
      data: { text: 'Hello' },
      meta: { requestId: 'test-123' },
    };

    const result = validateAndFormatEnvelope(envelope);
    const parsed = JSON.parse(result);

    expect(parsed.ok).toBe(true);
    expect(parsed.meta.requestId).toBe('test-123');
  });

  it('should add requestId if missing', () => {
    const envelope: OutputEnvelope = {
      ok: true,
      command: 'embed',
      data: null,
      meta: {},
    };

    const result = validateAndFormatEnvelope(envelope);
    const parsed = JSON.parse(result);

    expect(parsed.meta.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
  });

  it('should throw on invalid envelope', () => {
    const invalidEnvelope = {
      ok: 'yes', // Should be boolean
      command: 'chat',
      data: null,
      meta: {},
    } as any;

    expect(() => validateAndFormatEnvelope(invalidEnvelope)).toThrow(
      'Invalid envelope: "ok" field must be boolean'
    );
  });

  it('should throw on invalid command', () => {
    const invalidEnvelope = {
      ok: true,
      command: 'invalid',
      data: null,
      meta: {},
    } as any;

    expect(() => validateAndFormatEnvelope(invalidEnvelope)).toThrow(
      'Invalid envelope: "command" field must be one of'
    );
  });
});

describe('createMinimalSuccessEnvelope', () => {
  it('should create minimal success envelope', () => {
    const envelope = createMinimalSuccessEnvelope(
      'doctor',
      'All checks passed',
      { provider: 'openai' }
    );

    expect(envelope.ok).toBe(true);
    expect(envelope.command).toBe('doctor');
    expect(envelope.data).toEqual({
      message: 'All checks passed',
      provider: 'openai',
    });
  });
});

describe('redactSensitiveJson', () => {
  it('should redact API keys in JSON strings', () => {
    const jsonWithSecrets = JSON.stringify({
      config: {
        apiKey: 'sk-1234567890abcdef1234567890abcdef12345678901234567890',
        openai_api_key: 'sk-abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmn',
        other: 'safe-value',
      },
    });

    const redacted = redactSensitiveJson(jsonWithSecrets);
    const parsed = JSON.parse(redacted);

    expect(parsed.config.apiKey).toBe('****');
    expect(parsed.config.openai_api_key).toBe('****');
    expect(parsed.config.other).toBe('safe-value');
  });

  it('should handle malformed JSON with string redaction', () => {
    const malformedJson =
      '{"key": "sk-1234567890abcdef1234567890abcdef12345678901234567890", invalid}';

    const redacted = redactSensitiveJson(malformedJson);

    expect(redacted).toContain('sk-****');
    expect(redacted).not.toContain('sk-1234567890abcdef');
  });

  it('should redact nested sensitive fields', () => {
    const jsonWithNestedSecrets = JSON.stringify({
      providers: {
        openai: {
          apiKey: 'sk-test123456789',
          baseUrl: 'https://api.openai.com',
        },
        anthropic: {
          authorization: 'Bearer sk-ant-test123',
        },
      },
    });

    const redacted = redactSensitiveJson(jsonWithNestedSecrets);
    const parsed = JSON.parse(redacted);

    expect(parsed.providers.openai.apiKey).toBe('****');
    expect(parsed.providers.openai.baseUrl).toBe('https://api.openai.com');
    expect(parsed.providers.anthropic.authorization).toBe('****');
  });

  it('should handle arrays and preserve non-sensitive data', () => {
    const jsonWithArray = JSON.stringify({
      items: [
        { token: 'secret123456789', name: 'item1' },
        { token: 'short', name: 'item2' },
      ],
      count: 2,
    });

    const redacted = redactSensitiveJson(jsonWithArray);
    const parsed = JSON.parse(redacted);

    expect(parsed.items[0].token).toBe('****');
    expect(parsed.items[0].name).toBe('item1');
    expect(parsed.items[1].token).toBe('short'); // Short values not redacted
    expect(parsed.count).toBe(2);
  });
});
