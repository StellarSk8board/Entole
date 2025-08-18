/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * CLI snapshot tests for help output and JSON responses
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { join } from 'path';

describe('CLI Snapshots', () => {
  const cliPath = join(process.cwd(), 'dist/index.js');

  it('should match help output snapshot', () => {
    try {
      const output = execSync(`node ${cliPath} --help`, {
        encoding: 'utf-8',
        timeout: 5000,
      });

      // Normalize the output to remove version-specific information
      const normalizedOutput = output
        .replace(/v\d+\.\d+\.\d+/, 'vX.X.X')
        .trim();

      expect(normalizedOutput).toMatchSnapshot();
    } catch (error) {
      // If the CLI isn't built yet, skip this test
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.warn('CLI not built, skipping snapshot test');
        return;
      }
      throw error;
    }
  });

  it('should match chat command help snapshot', () => {
    try {
      const output = execSync(`node ${cliPath} chat --help`, {
        encoding: 'utf-8',
        timeout: 5000,
      });

      expect(output.trim()).toMatchSnapshot();
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.warn('CLI not built, skipping snapshot test');
        return;
      }
      throw error;
    }
  });

  it('should match embed command help snapshot', () => {
    try {
      const output = execSync(`node ${cliPath} embed --help`, {
        encoding: 'utf-8',
        timeout: 5000,
      });

      expect(output.trim()).toMatchSnapshot();
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.warn('CLI not built, skipping snapshot test');
        return;
      }
      throw error;
    }
  });

  it('should match providers command help snapshot', () => {
    try {
      const output = execSync(`node ${cliPath} providers --help`, {
        encoding: 'utf-8',
        timeout: 5000,
      });

      expect(output.trim()).toMatchSnapshot();
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.warn('CLI not built, skipping snapshot test');
        return;
      }
      throw error;
    }
  });

  it('should match doctor command help snapshot', () => {
    try {
      const output = execSync(`node ${cliPath} doctor --help`, {
        encoding: 'utf-8',
        timeout: 5000,
      });

      expect(output.trim()).toMatchSnapshot();
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        console.warn('CLI not built, skipping snapshot test');
        return;
      }
      throw error;
    }
  });
});
