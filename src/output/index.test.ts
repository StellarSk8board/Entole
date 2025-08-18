/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Unit tests for output module index
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOutputFormat, outputContent, outputError } from './index.js';

describe('getOutputFormat', () => {
  it('should return json when jsonFlag is true', () => {
    expect(getOutputFormat(true)).toBe('json');
  });

  it('should return human when jsonFlag is false', () => {
    expect(getOutputFormat(false)).toBe('human');
  });

  it('should return human when jsonFlag is undefined', () => {
    expect(getOutputFormat()).toBe('human');
  });
});

describe('outputContent', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
  });

  it('should output to stdout for human format', () => {
    outputContent('Hello world', 'human');
    expect(mockConsoleLog).toHaveBeenCalledWith('Hello world');
  });

  it('should output to stdout for json format', () => {
    outputContent('{"message": "hello"}', 'json');
    expect(mockConsoleLog).toHaveBeenCalledWith('{"message": "hello"}');
  });

  it('should default to human format', () => {
    outputContent('Default format');
    expect(mockConsoleLog).toHaveBeenCalledWith('Default format');
  });
});

describe('outputError', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('should output to stderr for human format', () => {
    outputError('Error message', 'human');
    expect(mockConsoleError).toHaveBeenCalledWith('Error message');
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it('should output to stdout for json format', () => {
    outputError('{"error": "something"}', 'json');
    expect(mockConsoleLog).toHaveBeenCalledWith('{"error": "something"}');
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  it('should default to human format', () => {
    outputError('Default error');
    expect(mockConsoleError).toHaveBeenCalledWith('Default error');
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });
});
