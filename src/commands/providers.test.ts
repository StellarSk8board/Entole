/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 */

import { describe, it, expect } from 'vitest';
import { providersCommand } from './providers.js';

describe('providers command', () => {
  it('should have correct command structure', () => {
    expect(providersCommand.name()).toBe('providers');
    expect(providersCommand.description()).toBe('Manage AI providers');

    const listCommand = providersCommand.commands.find(
      (cmd) => cmd.name() === 'list'
    );
    expect(listCommand).toBeDefined();
    expect(listCommand!.description()).toBe(
      'List available providers and their capabilities'
    );
  });

  it('should have list subcommand with correct options', () => {
    const listCommand = providersCommand.commands.find(
      (cmd) => cmd.name() === 'list'
    );
    expect(listCommand).toBeDefined();

    const options = listCommand!.options;
    const optionNames = options.map((opt) => opt.long);

    expect(optionNames).toContain('--json');
  });

  it('should have action handlers for subcommands', () => {
    const listCommand = providersCommand.commands.find(
      (cmd) => cmd.name() === 'list'
    );
    expect(listCommand).toBeDefined();
    expect(listCommand!._actionHandler).toBeDefined();
    expect(typeof listCommand!._actionHandler).toBe('function');
  });
});
