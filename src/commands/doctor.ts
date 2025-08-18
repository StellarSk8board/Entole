/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 *
 * Config doctor command for validating configuration and provider setup
 */

import { Command } from 'commander';
import {
  loadConfig,
  ConfigValidationError,
  ConfigFileError,
} from '../config/loader.js';
import { OllamaAdapter } from '../providers/ollama.js';
import { ENV_VAR_MAPPING } from '../config/schema.js';
import {
  getOutputFormat,
  outputContent,
  outputError,
  formatDoctorResultsJson,
  formatError,
  formatErrorJson,
} from '../output/index.js';

interface DoctorResult {
  ok: boolean;
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn';
    message: string;
    hint?: string;
  }>;
}

export const doctorCommand = new Command('doctor')
  .description('Validate configuration and provider setup')
  .option('--json', 'Output results in JSON format')
  .action(async (options) => {
    const outputFormat = getOutputFormat(options.json);

    try {
      const result = await runDoctorChecks();

      if (outputFormat === 'json') {
        // Convert to the expected format for JSON output
        const jsonResult = {
          configValid: result.ok,
          providers: result.checks
            .filter(
              (check) =>
                check.name.includes('Environment') ||
                check.name.includes('Connectivity') ||
                check.name.includes('API Key')
            )
            .map((check) => ({
              key: check.name.toLowerCase().split(' ')[0],
              available: check.status === 'pass',
              error: check.status === 'fail' ? check.message : undefined,
              hint: check.hint,
            })),
          issues: result.checks
            .filter((check) => check.status === 'fail')
            .map(
              (check) =>
                `${check.name}: ${check.message}${check.hint ? ` (${check.hint})` : ''}`
            ),
        };

        const jsonOutput = formatDoctorResultsJson(jsonResult);
        outputContent(jsonOutput, outputFormat);
      } else {
        printHumanReadableResults(result);
      }

      // Exit with non-zero code if any checks failed
      if (!result.ok) {
        process.exit(1);
      }
    } catch (error) {
      const normalizedError = {
        provider: 'doctor',
        type: 'internal' as const,
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
      };

      if (outputFormat === 'json') {
        const errorResult = formatErrorJson('doctor', normalizedError);
        outputError(errorResult, outputFormat);
      } else {
        const errorResult = formatError(normalizedError);
        outputError(errorResult, outputFormat);
      }

      process.exit(1);
    }
  });

/**
 * Run all doctor checks
 */
async function runDoctorChecks(): Promise<DoctorResult> {
  const checks: DoctorResult['checks'] = [];

  // Check 1: Configuration loading and validation
  await checkConfiguration(checks);

  // Check 2: Environment variables
  checkEnvironmentVariables(checks);

  // Check 3: Provider connectivity (where applicable)
  await checkProviderConnectivity(checks);

  const hasFailures = checks.some((check) => check.status === 'fail');

  return {
    ok: !hasFailures,
    checks,
  };
}

/**
 * Check configuration loading and validation
 */
async function checkConfiguration(
  checks: DoctorResult['checks']
): Promise<void> {
  try {
    const configResult = await loadConfig();

    checks.push({
      name: 'Configuration Loading',
      status: 'pass',
      message: 'Configuration loaded successfully',
    });

    // Report configuration sources
    const sources = [];
    if (configResult.sources.env.length > 0) {
      sources.push(`${configResult.sources.env.length} environment variables`);
    }
    if (configResult.sources.file) {
      sources.push(`config file: ${configResult.sources.file}`);
    }
    if (configResult.sources.cli.length > 0) {
      sources.push(`${configResult.sources.cli.length} CLI flags`);
    }

    if (sources.length > 0) {
      checks.push({
        name: 'Configuration Sources',
        status: 'pass',
        message: `Found: ${sources.join(', ')}`,
      });
    } else {
      checks.push({
        name: 'Configuration Sources',
        status: 'warn',
        message: 'No configuration sources found, using defaults',
        hint: 'Consider creating an entole.config.json file or setting environment variables',
      });
    }
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      checks.push({
        name: 'Configuration Validation',
        status: 'fail',
        message: 'Configuration validation failed',
        hint: `Issues found: ${error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      });
    } else if (error instanceof ConfigFileError) {
      checks.push({
        name: 'Configuration File',
        status: 'fail',
        message: 'Failed to parse configuration file',
        hint: error.cause,
      });
    } else {
      checks.push({
        name: 'Configuration Loading',
        status: 'fail',
        message: 'Unexpected error loading configuration',
        hint: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Check environment variables for each provider
 */
function checkEnvironmentVariables(checks: DoctorResult['checks']): void {
  const providerEnvVars = {
    openai: ['OPENAI_API_KEY'],
    anthropic: ['ANTHROPIC_API_KEY'],
    openrouter: ['OPENROUTER_API_KEY'],
    ollama: ['OLLAMA_HOST', 'OLLAMA_MODEL'],
  };

  for (const [provider, envVars] of Object.entries(providerEnvVars)) {
    const foundVars = envVars.filter((envVar) => process.env[envVar]);
    const missingVars = envVars.filter((envVar) => !process.env[envVar]);

    if (foundVars.length === envVars.length) {
      checks.push({
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Environment`,
        status: 'pass',
        message: `All required environment variables found: ${foundVars.join(', ')}`,
      });
    } else if (foundVars.length > 0) {
      checks.push({
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Environment`,
        status: 'warn',
        message: `Some environment variables found: ${foundVars.join(', ')}`,
        hint: `Missing optional variables: ${missingVars.join(', ')}`,
      });
    } else {
      const isRequired = provider !== 'ollama'; // Ollama has defaults
      checks.push({
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Environment`,
        status: isRequired ? 'fail' : 'warn',
        message: `No environment variables found for ${provider}`,
        hint: `Set ${missingVars.join(' and/or ')} to use ${provider}`,
      });
    }
  }

  // Check for unknown environment variables that might be typos
  const knownEnvVars = new Set(Object.keys(ENV_VAR_MAPPING));
  const suspiciousVars = Object.keys(process.env).filter(
    (key) =>
      (key.startsWith('ENTOLE_') ||
        key.includes('OPENAI') ||
        key.includes('ANTHROPIC') ||
        key.includes('OLLAMA') ||
        key.includes('OPENROUTER')) &&
      !knownEnvVars.has(key)
  );

  if (suspiciousVars.length > 0) {
    checks.push({
      name: 'Environment Variable Typos',
      status: 'warn',
      message: `Found potentially misspelled environment variables: ${suspiciousVars.join(', ')}`,
      hint: `Check spelling against known variables: ${Array.from(knownEnvVars).join(', ')}`,
    });
  }
}

/**
 * Check provider connectivity where applicable
 */
async function checkProviderConnectivity(
  checks: DoctorResult['checks']
): Promise<void> {
  // Check Ollama connectivity if configured
  const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
  const ollamaModel = process.env.OLLAMA_MODEL;

  try {
    const ollama = new OllamaAdapter({
      host: ollamaHost,
      defaultModel: ollamaModel,
    });

    const healthResult = await ollama.healthCheck();

    if (healthResult.healthy) {
      checks.push({
        name: 'Ollama Connectivity',
        status: 'pass',
        message: `Successfully connected to Ollama at ${ollamaHost}`,
      });

      // Try to get models to verify full functionality
      try {
        const models = await ollama.getModels();
        if (models.length > 0) {
          checks.push({
            name: 'Ollama Models',
            status: 'pass',
            message: `Found ${models.length} available models: ${models
              .slice(0, 3)
              .map((m) => m.name)
              .join(', ')}${models.length > 3 ? '...' : ''}`,
          });
        } else {
          checks.push({
            name: 'Ollama Models',
            status: 'warn',
            message: 'No models found in Ollama',
            hint: 'Pull a model with: ollama pull llama2',
          });
        }
      } catch (error) {
        checks.push({
          name: 'Ollama Models',
          status: 'warn',
          message: 'Could not retrieve model list',
          hint: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      checks.push({
        name: 'Ollama Connectivity',
        status: 'fail',
        message: `Cannot connect to Ollama at ${ollamaHost}`,
        hint:
          healthResult.error ||
          'Check that Ollama is running with: ollama serve',
      });
    }
  } catch (error) {
    checks.push({
      name: 'Ollama Connectivity',
      status: 'fail',
      message: 'Failed to test Ollama connectivity',
      hint: error instanceof Error ? error.message : String(error),
    });
  }

  // For other providers, we can only check if API keys are present
  // We don't make actual API calls to avoid unnecessary usage/costs
  const apiKeyProviders = [
    { name: 'OpenAI', envVar: 'OPENAI_API_KEY' },
    { name: 'Anthropic', envVar: 'ANTHROPIC_API_KEY' },
    { name: 'OpenRouter', envVar: 'OPENROUTER_API_KEY' },
  ];

  for (const { name, envVar } of apiKeyProviders) {
    const apiKey = process.env[envVar];
    if (apiKey) {
      // Basic validation of API key format
      let isValidFormat = false;
      let hint = '';

      if (
        name === 'OpenAI' &&
        apiKey.startsWith('sk-') &&
        apiKey.length >= 20
      ) {
        isValidFormat = true;
      } else if (
        name === 'Anthropic' &&
        apiKey.startsWith('sk-ant-') &&
        apiKey.length >= 20
      ) {
        isValidFormat = true;
      } else if (name === 'OpenRouter' && apiKey.length >= 20) {
        isValidFormat = true;
      } else {
        hint = `API key format appears invalid for ${name}`;
      }

      checks.push({
        name: `${name} API Key`,
        status: isValidFormat ? 'pass' : 'warn',
        message: isValidFormat
          ? `${name} API key is present and appears valid`
          : `${name} API key is present but format is questionable`,
        hint: hint || undefined,
      });
    }
  }
}

/**
 * Print human-readable results
 */
function printHumanReadableResults(result: DoctorResult): void {
  console.log('🏥 Entole Configuration Doctor\n');

  const passCount = result.checks.filter((c) => c.status === 'pass').length;
  const warnCount = result.checks.filter((c) => c.status === 'warn').length;
  const failCount = result.checks.filter((c) => c.status === 'fail').length;

  for (const check of result.checks) {
    const icon =
      check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
    console.log(`${icon} ${check.name}: ${check.message}`);

    if (check.hint) {
      console.log(`   💡 ${check.hint}`);
    }
    console.log();
  }

  console.log('📊 Summary:');
  console.log(`   ✅ ${passCount} passed`);
  if (warnCount > 0) {
    console.log(`   ⚠️  ${warnCount} warnings`);
  }
  if (failCount > 0) {
    console.log(`   ❌ ${failCount} failed`);
  }

  if (result.ok) {
    console.log('\n🎉 All critical checks passed! Entole is ready to use.');
  } else {
    console.log(
      '\n🚨 Some checks failed. Please address the issues above before using Entole.'
    );
  }
}
