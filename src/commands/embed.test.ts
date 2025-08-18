/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 */

import { describe, it, expect } from 'vitest';
import { embedCommand } from './embed.js';

describe('embed command', () => {
  it('should have correct command structure', () => {
    expect(embedCommand.name()).toBe('embed');
    expect(embedCommand.description()).toBe('Generate embeddings for text');

    // Check that it has the expected options
    const options = embedCommand.options;
    const optionNames = options.map((opt) => opt.long);

    expect(optionNames).toContain('--provider');
    expect(optionNames).toContain('--model');
    expect(optionNames).toContain('--json');
  });

  it('should have correct argument structure', () => {
    // Commander.js stores arguments in the _args property
    const args = (embedCommand as any)._args;
    expect(args).toHaveLength(1);
    expect(args[0].name()).toBe('input');
    expect(args[0].description).toBe(
      'Text to embed (or @filename to read from file)'
    );
    expect(args[0].required).toBe(true); // Required argument
  });

  it('should have an action handler', () => {
    expect(embedCommand._actionHandler).toBeDefined();
    expect(typeof embedCommand._actionHandler).toBe('function');
  });
});
