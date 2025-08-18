#!/usr/bin/env node

// src/index.ts
import { Command as Command5 } from "commander";
import { readFileSync as readFileSync4 } from "fs";
import { fileURLToPath } from "url";
import { dirname, join as join3 } from "path";

// src/timings.ts
import { mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
var Database = null;
var SQLiteTimingCollector = class {
  db = null;
  dbPath;
  constructor(dbPath) {
    this.dbPath = dbPath;
  }
  async ensureDatabase() {
    if (this.db) return;
    try {
      if (!Database) {
        Database = (await import("better-sqlite3")).default;
      }
      const cacheDir = join(homedir(), ".cache", "entole");
      await mkdir(cacheDir, { recursive: true });
      this.db = new Database(this.dbPath);
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS timings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts INTEGER NOT NULL,
          command TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT,
          duration_ms INTEGER NOT NULL,
          input_tokens INTEGER,
          output_tokens INTEGER,
          ok INTEGER NOT NULL
        )
      `);
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_timings_ts ON timings(ts);
        CREATE INDEX IF NOT EXISTS idx_timings_command ON timings(command);
        CREATE INDEX IF NOT EXISTS idx_timings_provider ON timings(provider);
      `);
    } catch (error) {
      if (error?.code === "MODULE_NOT_FOUND") {
        throw new Error(
          'Timing collection requires the optional dependency "better-sqlite3". Install it with: npm install better-sqlite3'
        );
      }
      throw error;
    }
  }
  async record(timing) {
    await this.ensureDatabase();
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    const stmt = this.db.prepare(`
      INSERT INTO timings (ts, command, provider, model, duration_ms, input_tokens, output_tokens, ok)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      timing.ts,
      timing.command,
      timing.provider,
      timing.model || null,
      timing.duration_ms,
      timing.input_tokens || null,
      timing.output_tokens || null,
      timing.ok ? 1 : 0
    );
  }
  async query(options = {}) {
    await this.ensureDatabase();
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    let sql = "SELECT * FROM timings WHERE 1=1";
    const params = [];
    if (options.since) {
      sql += " AND ts >= ?";
      params.push(options.since.getTime());
    }
    if (options.command) {
      sql += " AND command = ?";
      params.push(options.command);
    }
    if (options.provider) {
      sql += " AND provider = ?";
      params.push(options.provider);
    }
    sql += " ORDER BY ts DESC";
    if (options.limit) {
      sql += " LIMIT ?";
      params.push(options.limit);
    }
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map((row) => {
      const r = row;
      return {
        id: r.id,
        ts: r.ts,
        command: r.command,
        provider: r.provider,
        model: r.model,
        duration_ms: r.duration_ms,
        input_tokens: r.input_tokens,
        output_tokens: r.output_tokens,
        ok: Boolean(r.ok)
      };
    });
  }
  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
};
var NoOpTimingCollector = class {
  async record(_timing) {
  }
  async query(_options) {
    return [];
  }
  async close() {
  }
};
var globalCollector = null;
function initializeTimings(enabled) {
  if (globalCollector) {
    return globalCollector;
  }
  if (enabled) {
    const dbPath = join(homedir(), ".cache", "entole", "timings.sqlite");
    globalCollector = new SQLiteTimingCollector(dbPath);
  } else {
    globalCollector = new NoOpTimingCollector();
  }
  return globalCollector;
}
function getTimingCollector() {
  if (!globalCollector) {
    globalCollector = new NoOpTimingCollector();
  }
  return globalCollector;
}
async function withTiming(operation, metadata) {
  const collector = getTimingCollector();
  const startTime = Date.now();
  let result;
  let success = false;
  let inputTokens;
  let outputTokens;
  try {
    result = await operation();
    success = true;
    if (result && typeof result === "object") {
      const resultObj = result;
      const meta = resultObj.meta;
      const usage = meta?.usage;
      if (usage) {
        inputTokens = usage.prompt_tokens;
        outputTokens = usage.completion_tokens;
      }
    }
    return result;
  } finally {
    const endTime = Date.now();
    const duration = endTime - startTime;
    await collector.record({
      ts: startTime,
      command: metadata.command,
      provider: metadata.provider,
      model: metadata.model,
      duration_ms: duration,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      ok: success
    });
  }
}
async function closeTimings() {
  if (globalCollector) {
    await globalCollector.close();
    globalCollector = null;
  }
}

// src/commands/chat.ts
import { Command } from "commander";
import { readFileSync as readFileSync2, existsSync as existsSync2 } from "fs";

// src/config/loader.ts
import { readFileSync, existsSync } from "fs";
import { resolve, join as join2 } from "path";
import { homedir as homedir2 } from "os";
import * as YAML from "yaml";

// src/config/schema.ts
import { z } from "zod";
var OpenAIConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  defaultModel: z.string().optional()
}).strict();
var AnthropicConfigSchema = z.object({
  apiKey: z.string().optional(),
  defaultModel: z.string().optional()
}).strict();
var OllamaConfigSchema = z.object({
  host: z.string().url().optional(),
  defaultModel: z.string().optional()
}).strict();
var OpenRouterConfigSchema = z.object({
  apiKey: z.string().optional(),
  defaultModel: z.string().optional()
}).strict();
var DefaultProviderConfigSchema = z.object({
  chat: z.string().optional(),
  embeddings: z.string().optional()
}).strict();
var ProvidersConfigSchema = z.object({
  default: DefaultProviderConfigSchema.optional(),
  openai: OpenAIConfigSchema.optional(),
  anthropic: AnthropicConfigSchema.optional(),
  ollama: OllamaConfigSchema.optional(),
  openrouter: OpenRouterConfigSchema.optional()
}).strict();
var OutputConfigSchema = z.object({
  format: z.enum(["human", "json"]).optional(),
  streaming: z.boolean().optional()
}).strict();
var ObservabilityConfigSchema = z.object({
  timings: z.boolean().optional()
}).strict();
var EntoleConfigSchema = z.object({
  providers: ProvidersConfigSchema.optional(),
  output: OutputConfigSchema.optional(),
  observability: ObservabilityConfigSchema.optional()
}).strict();
var ENV_VAR_MAPPING = {
  // Provider API keys
  OPENAI_API_KEY: "providers.openai.apiKey",
  ANTHROPIC_API_KEY: "providers.anthropic.apiKey",
  OPENROUTER_API_KEY: "providers.openrouter.apiKey",
  // Ollama configuration
  OLLAMA_HOST: "providers.ollama.host",
  OLLAMA_MODEL: "providers.ollama.defaultModel",
  // Default models
  ENTOLE_DEFAULT_CHAT_PROVIDER: "providers.default.chat",
  ENTOLE_DEFAULT_EMBEDDINGS_PROVIDER: "providers.default.embeddings",
  // Output configuration
  ENTOLE_OUTPUT_FORMAT: "output.format",
  ENTOLE_STREAMING: "output.streaming",
  // Observability
  ENTOLE_TIMINGS: "observability.timings"
};
var CLI_FLAG_MAPPING = {
  provider: "providers.default.chat",
  format: "output.format",
  stream: "output.streaming",
  json: "output.format"
  // Special case: --json sets format to 'json'
};

// src/config/loader.ts
async function loadConfig(options = {}) {
  const sources = {
    env: [],
    file: void 0,
    cli: []
  };
  let config = {};
  if (options.cliFlags) {
    const cliConfig = loadFromCliFlags(options.cliFlags);
    config = mergeConfigs(config, cliConfig);
    sources.cli = Object.keys(options.cliFlags).filter(
      (key) => key in CLI_FLAG_MAPPING
    );
  }
  const fileConfig = await loadFromConfigFile(options.configPath);
  if (fileConfig.config) {
    config = mergeConfigs(config, fileConfig.config);
    sources.file = fileConfig.path;
  }
  const envConfig = loadFromEnvironment();
  if (Object.keys(envConfig.config).length > 0) {
    config = mergeConfigs(config, envConfig.config);
    sources.env = envConfig.sources;
  }
  const validationResult = EntoleConfigSchema.safeParse(config);
  if (!validationResult.success) {
    throw new ConfigValidationError(
      "Configuration validation failed",
      validationResult.error.issues
    );
  }
  return {
    config: validationResult.data,
    sources
  };
}
function loadFromEnvironment() {
  const config = {};
  const sources = [];
  for (const [envVar, configPath] of Object.entries(ENV_VAR_MAPPING)) {
    const value = process.env[envVar];
    if (value !== void 0) {
      setNestedValue(config, configPath, parseEnvValue(value));
      sources.push(envVar);
    }
  }
  return { config, sources };
}
async function loadFromConfigFile(configPath) {
  const possiblePaths = configPath ? [configPath] : [
    "entole.config.json",
    "entole.config.yaml",
    "entole.config.yml",
    join2(homedir2(), ".entole", "config.json"),
    join2(homedir2(), ".entole", "config.yaml"),
    join2(homedir2(), ".entole", "config.yml")
  ];
  for (const path of possiblePaths) {
    const resolvedPath = resolve(path);
    if (existsSync(resolvedPath)) {
      try {
        const content = readFileSync(resolvedPath, "utf-8");
        const config = path.endsWith(".json") ? JSON.parse(content) : YAML.parse(content);
        return { config, path: resolvedPath };
      } catch (error) {
        throw new ConfigFileError(
          `Failed to parse config file: ${resolvedPath}`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }
  return {};
}
function loadFromCliFlags(flags) {
  const config = {};
  for (const [flag, configPath] of Object.entries(CLI_FLAG_MAPPING)) {
    const value = flags[flag];
    if (value !== void 0 && value !== null) {
      if (flag === "json" && value === true) {
        setNestedValue(config, "output.format", "json");
      } else if (flag !== "json") {
        setNestedValue(config, configPath, value);
      }
    }
  }
  return config;
}
function parseEnvValue(value) {
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
  return value;
}
function setNestedValue(obj, path, value) {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || typeof current[key] !== "object" || current[key] === null) {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}
function mergeConfigs(base, override) {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value !== void 0) {
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        result[key] = mergeConfigs(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}
var ConfigValidationError = class extends Error {
  constructor(message, issues) {
    super(message);
    this.issues = issues;
    this.name = "ConfigValidationError";
  }
};
var ConfigFileError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ConfigFileError";
  }
};

// src/providers/registry.ts
var ProviderRegistry = class {
  providers = /* @__PURE__ */ new Map();
  initialized = false;
  /**
   * Register a provider adapter
   *
   * @param adapter - The provider adapter to register
   *
   * @example
   * ```typescript
   * const registry = new ProviderRegistry();
   * registry.register(new OpenAIAdapter({ apiKey: 'sk-...' }));
   * ```
   */
  register(adapter) {
    this.providers.set(adapter.key, adapter);
  }
  /**
   * Get a provider adapter by key
   */
  get(key) {
    this.ensureInitialized();
    return this.providers.get(key);
  }
  /**
   * Get all registered provider keys
   */
  getKeys() {
    this.ensureInitialized();
    return Array.from(this.providers.keys());
  }
  /**
   * Get all registered providers
   */
  getAll() {
    this.ensureInitialized();
    return Array.from(this.providers.values());
  }
  /**
   * Check if a provider is registered
   */
  has(key) {
    this.ensureInitialized();
    return this.providers.has(key);
  }
  /**
   * Get providers that support a specific capability
   */
  getByCapability(capability) {
    this.ensureInitialized();
    return Array.from(this.providers.values()).filter(
      (provider) => provider.capabilities[capability]
    );
  }
  /**
   * Resolve a provider with fallback logic
   *
   * @param preferredProvider - Specific provider key to use (optional)
   * @param capability - Required capability the provider must support (optional)
   * @returns The resolved provider adapter
   * @throws Error if no suitable provider is found
   *
   * @example
   * ```typescript
   * // Get specific provider
   * const openai = registry.resolve('openai');
   *
   * // Get any provider that supports chat
   * const chatProvider = registry.resolve(undefined, 'chat');
   *
   * // Get specific provider with capability check
   * const openaiChat = registry.resolve('openai', 'chat');
   * ```
   */
  resolve(preferredProvider, capability) {
    this.ensureInitialized();
    if (preferredProvider) {
      const provider = this.providers.get(preferredProvider);
      if (!provider) {
        throw new Error(`Provider '${preferredProvider}' is not available`);
      }
      if (capability && !provider.capabilities[capability]) {
        throw new Error(
          `Provider '${preferredProvider}' does not support ${capability}`
        );
      }
      return provider;
    }
    if (capability) {
      const supportingProviders = this.getByCapability(capability);
      if (supportingProviders.length === 0) {
        throw new Error(`No providers available that support ${capability}`);
      }
      return supportingProviders[0];
    }
    const allProviders = this.getAll();
    if (allProviders.length === 0) {
      throw new Error("No providers are available");
    }
    return allProviders[0];
  }
  /**
   * Validate that a provider supports required capabilities
   */
  validateCapabilities(providerKey, requiredCapabilities) {
    const provider = this.get(providerKey);
    if (!provider) {
      throw new Error(`Provider '${providerKey}' is not available`);
    }
    const unsupported = requiredCapabilities.filter(
      (capability) => !provider.capabilities[capability]
    );
    if (unsupported.length > 0) {
      throw new Error(
        `Provider '${providerKey}' does not support: ${unsupported.join(", ")}`
      );
    }
  }
  /**
   * Get provider information for display purposes
   */
  getProviderInfo() {
    this.ensureInitialized();
    return Array.from(this.providers.values()).map((provider) => ({
      key: provider.key,
      label: provider.label,
      capabilities: provider.capabilities
    }));
  }
  /**
   * Clear all registered providers (mainly for testing)
   */
  clear() {
    this.providers.clear();
    this.initialized = false;
  }
  /**
   * Lazy initialization of providers
   */
  ensureInitialized() {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
  }
};
var providerRegistry = new ProviderRegistry();
function registerProvider(adapter) {
  providerRegistry.register(adapter);
}
function getProvider(key) {
  return providerRegistry.get(key);
}
function resolveProvider(preferredProvider, capability) {
  return providerRegistry.resolve(preferredProvider, capability);
}
function getProviderInfo() {
  return providerRegistry.getProviderInfo();
}

// src/output/human.ts
function formatChatResponse(response, provider, model) {
  const lines = [];
  lines.push(response.text);
  if (response.meta || provider || model) {
    lines.push("");
    const metaLines = [];
    if (provider) {
      metaLines.push(`Provider: ${provider}`);
    }
    if (model || response.meta?.model) {
      metaLines.push(`Model: ${model || response.meta?.model}`);
    }
    if (response.meta?.usage) {
      const usage = response.meta.usage;
      const parts = [];
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
        metaLines.push(`Usage: ${parts.join(", ")}`);
      }
    }
    if (response.meta?.finish_reason) {
      metaLines.push(`Finish reason: ${response.meta.finish_reason}`);
    }
    if (metaLines.length > 0) {
      lines.push(`\u2500\u2500\u2500 ${metaLines.join(" \u2022 ")} \u2500\u2500\u2500`);
    }
  }
  return lines.join("\n");
}
function formatEmbeddingResponse(response, provider, model) {
  const lines = [];
  const vectorCount = response.vectors.length;
  const dimensions = response.vectors[0]?.length || 0;
  lines.push(
    `Generated ${vectorCount} embedding${vectorCount === 1 ? "" : "s"} with ${dimensions} dimensions`
  );
  if (response.vectors.length > 0 && response.vectors[0].length > 0) {
    const firstVector = response.vectors[0];
    const preview = firstVector.slice(0, 5).map((v) => v.toFixed(4)).join(", ");
    const more = firstVector.length > 5 ? ", ..." : "";
    lines.push(`Preview: [${preview}${more}]`);
  }
  const metaLines = [];
  if (provider) {
    metaLines.push(`Provider: ${provider}`);
  }
  if (model || response.meta?.model) {
    metaLines.push(`Model: ${model || response.meta?.model}`);
  }
  if (response.meta?.usage) {
    const usage = response.meta.usage;
    const parts = [];
    if (usage.prompt_tokens) {
      parts.push(`${usage.prompt_tokens} prompt`);
    }
    if (usage.total_tokens) {
      parts.push(`${usage.total_tokens} total tokens`);
    }
    if (parts.length > 0) {
      metaLines.push(`Usage: ${parts.join(", ")}`);
    }
  }
  if (metaLines.length > 0) {
    lines.push("");
    lines.push(`\u2500\u2500\u2500 ${metaLines.join(" \u2022 ")} \u2500\u2500\u2500`);
  }
  return lines.join("\n");
}
function formatProviderList(providers) {
  if (providers.length === 0) {
    return "No providers available";
  }
  const lines = [];
  lines.push("Available providers:");
  lines.push("");
  for (const provider of providers) {
    const capabilities = [];
    if (provider.capabilities.chat) {
      capabilities.push("chat");
    }
    if (provider.capabilities.embeddings) {
      capabilities.push("embeddings");
    }
    if (provider.capabilities.image) {
      capabilities.push("image");
    }
    if (provider.capabilities.tools) {
      capabilities.push("tools");
    }
    const capabilityText = capabilities.length > 0 ? ` (${capabilities.join(", ")})` : " (no capabilities)";
    lines.push(
      `  ${provider.key.padEnd(12)} ${provider.label}${capabilityText}`
    );
  }
  return lines.join("\n");
}
function formatError(error) {
  const lines = [];
  lines.push(`\u274C Error from ${error.provider}:`);
  lines.push(`   ${error.message}`);
  if (error.hint) {
    lines.push("");
    lines.push(`\u{1F4A1} ${error.hint}`);
  }
  if (error.retryable) {
    lines.push("");
    lines.push(
      "\u{1F504} This error is retryable - the operation may succeed if tried again."
    );
  }
  return lines.join("\n");
}
var StreamingOutput = class {
  buffer = "";
  isFirstChunk = true;
  /**
   * Process a streaming chunk and output it to console
   */
  processChunk(chunk) {
    if (this.isFirstChunk) {
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
  finalize(finalChunk) {
    process.stdout.write("\n");
    if (finalChunk.meta) {
      const metaLines = [];
      if (finalChunk.meta.model) {
        metaLines.push(`Model: ${finalChunk.meta.model}`);
      }
      if (finalChunk.meta.usage) {
        const usage = finalChunk.meta.usage;
        const parts = [];
        if (typeof usage.prompt_tokens === "number") {
          parts.push(`${usage.prompt_tokens} prompt`);
        }
        if (typeof usage.completion_tokens === "number") {
          parts.push(`${usage.completion_tokens} completion`);
        }
        if (typeof usage.total_tokens === "number") {
          parts.push(`${usage.total_tokens} total tokens`);
        }
        if (parts.length > 0) {
          metaLines.push(`Usage: ${parts.join(", ")}`);
        }
      }
      if (metaLines.length > 0) {
        process.stdout.write(`
\u2500\u2500\u2500 ${metaLines.join(" \u2022 ")} \u2500\u2500\u2500
`);
      }
    }
  }
  /**
   * Get the accumulated text content
   */
  getContent() {
    return this.buffer;
  }
  /**
   * Handle streaming error
   */
  handleError(error) {
    if (!this.isFirstChunk) {
      process.stdout.write("\n");
    }
    console.error(formatError(error));
  }
};

// src/output/json.ts
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
function createSuccessEnvelope(command, data, options = {}) {
  return {
    ok: true,
    command,
    provider: options.provider,
    model: options.model,
    data,
    meta: {
      requestId: generateRequestId(),
      timingsMs: options.timingsMs
    }
  };
}
function createErrorEnvelope(command, error, options = {}) {
  return {
    ok: false,
    command,
    provider: options.provider || error.provider,
    model: options.model,
    data: null,
    meta: {
      requestId: generateRequestId(),
      timingsMs: options.timingsMs,
      error
    }
  };
}
function formatChatResponseJson(response, provider, model, timingsMs) {
  const envelope = createSuccessEnvelope(
    "chat",
    {
      text: response.text,
      meta: response.meta
    },
    {
      provider,
      model: model || response.meta?.model,
      timingsMs
    }
  );
  return JSON.stringify(envelope, null, 2);
}
function formatEmbeddingResponseJson(response, provider, model, timingsMs) {
  const envelope = createSuccessEnvelope(
    "embed",
    {
      vectors: response.vectors,
      meta: response.meta
    },
    {
      provider,
      model: model || response.meta?.model,
      timingsMs
    }
  );
  return JSON.stringify(envelope, null, 2);
}
function formatProviderListJson(providers, timingsMs) {
  const data = providers;
  const envelope = createSuccessEnvelope("providers", data, { timingsMs });
  return JSON.stringify(envelope, null, 2);
}
function formatErrorJson(command, error, provider, model, timingsMs) {
  const envelope = createErrorEnvelope(command, error, {
    provider,
    model,
    timingsMs
  });
  return JSON.stringify(envelope, null, 2);
}
function formatDoctorResultsJson(results, timingsMs) {
  const envelope = createSuccessEnvelope("doctor", results, { timingsMs });
  return JSON.stringify(envelope, null, 2);
}
var StreamingJsonOutput = class {
  chunks = [];
  provider;
  model;
  timingsMs;
  constructor(provider, model, timingsMs) {
    this.provider = provider;
    this.model = model;
    this.timingsMs = timingsMs;
  }
  /**
   * Process a streaming chunk
   */
  processChunk(chunk) {
    this.chunks.push(chunk);
    const chunkEnvelope = {
      type: "chunk",
      requestId: generateRequestId(),
      chunk: {
        delta: chunk.delta,
        done: chunk.done,
        meta: chunk.meta
      }
    };
    console.error(JSON.stringify(chunkEnvelope));
  }
  /**
   * Finalize streaming and output complete response
   */
  finalize() {
    const fullText = this.chunks.filter((chunk) => chunk.delta).map((chunk) => chunk.delta).join("");
    const finalChunk = this.chunks[this.chunks.length - 1];
    const meta = finalChunk?.meta;
    const response = {
      text: fullText,
      meta
    };
    return formatChatResponseJson(
      response,
      this.provider,
      this.model,
      this.timingsMs
    );
  }
  /**
   * Handle streaming error
   */
  handleError(error) {
    return formatErrorJson(
      "chat",
      error,
      this.provider,
      this.model,
      this.timingsMs
    );
  }
};

// src/output/index.ts
function getOutputFormat(jsonFlag) {
  return jsonFlag ? "json" : "human";
}
function outputContent(content, format = "human") {
  if (format === "json") {
    console.log(content);
  } else {
    console.log(content);
  }
}
function outputError(content, format = "human") {
  if (format === "json") {
    console.log(content);
  } else {
    console.error(content);
  }
}

// src/providers/types.ts
function normalizeHttpError(response, provider, body) {
  const status = response.status;
  const statusText = response.statusText || "Unknown Error";
  let type;
  let retryable = false;
  let hint;
  switch (true) {
    case status === 401:
      type = "auth";
      hint = `Check your ${provider.toUpperCase()}_API_KEY environment variable`;
      break;
    case status === 429:
      type = "rate_limit";
      retryable = true;
      hint = "Rate limit exceeded. The request will be retried automatically.";
      break;
    case status >= 500:
      type = "internal";
      retryable = true;
      hint = "Server error. The request will be retried automatically.";
      break;
    case status >= 400:
      type = "bad_request";
      hint = "Check your request parameters and model availability";
      break;
    default:
      type = "network";
      retryable = true;
  }
  let message = `HTTP ${status}: ${statusText}`;
  if (body && typeof body === "object" && body !== null) {
    const errorBody = body;
    if (errorBody.error && typeof errorBody.error === "object") {
      const error = errorBody.error;
      if (typeof error.message === "string") {
        message = error.message;
      }
    } else if (typeof errorBody.message === "string") {
      message = errorBody.message;
    }
  }
  return {
    provider,
    type,
    message,
    hint,
    httpStatus: status,
    retryable
  };
}
function normalizeNetworkError(error, provider) {
  let message = "Network connection failed";
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  }
  return {
    provider,
    type: "network",
    message,
    hint: "Check your internet connection and provider endpoint",
    retryable: true
  };
}
function createNotImplementedError(provider, feature) {
  return {
    provider,
    type: "not_implemented",
    message: `${feature} is not yet implemented for ${provider}`,
    hint: `The ${provider} adapter is a placeholder. Consider using a different provider.`,
    retryable: false
  };
}
function validateRequiredConfig(config, requiredFields, provider) {
  const missing = requiredFields.filter((field) => !config[field]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration for ${provider}: ${missing.join(", ")}`
    );
  }
}
async function safeParseJsonResponse(response) {
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
function createHeaders(apiKey, authType = "bearer", customHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "entole/1.0.0",
    ...customHeaders
  };
  switch (authType) {
    case "bearer":
      headers["Authorization"] = `Bearer ${apiKey}`;
      break;
    case "api-key":
      headers["X-API-Key"] = apiKey;
      break;
  }
  return headers;
}

// src/providers/base.ts
var BaseProviderAdapter = class {
  /**
   * Default implementation throws not implemented error
   */
  async invokeChat(_params) {
    throw this.createNotImplementedError("chat");
  }
  /**
   * Default implementation throws not implemented error
   */
  async *invokeChatStream(_params) {
    yield { delta: "", done: true };
    throw this.createNotImplementedError("streaming chat");
  }
  /**
   * Default implementation throws not implemented error
   */
  async invokeEmbeddings(_params) {
    throw this.createNotImplementedError("embeddings");
  }
  /**
   * Default implementation returns empty array
   */
  async getModels() {
    return [];
  }
  /**
   * Normalize errors into our standard format
   */
  normalizeError(error) {
    if (error instanceof Response) {
      return normalizeHttpError(error, this.key);
    }
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return normalizeNetworkError(error, this.key);
    }
    if (this.isNormalizedError(error)) {
      return error;
    }
    if (error instanceof Error) {
      return {
        provider: this.key,
        type: "internal",
        message: error.message,
        retryable: false
      };
    }
    return {
      provider: this.key,
      type: "internal",
      message: "An unknown error occurred",
      retryable: false
    };
  }
  /**
   * Helper method to make HTTP requests with error handling
   */
  async makeRequest(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "User-Agent": "entole/1.0.0",
          ...options.headers
        }
      });
      if (!response.ok) {
        const body = await safeParseJsonResponse(response);
        throw normalizeHttpError(response, this.key, body);
      }
      return response;
    } catch (error) {
      if (this.isNormalizedError(error)) {
        throw error;
      }
      throw this.normalizeError(error);
    }
  }
  /**
   * Helper method to make streaming requests
   */
  async makeStreamingRequest(url, options = {}) {
    const response = await this.makeRequest(url, options);
    if (!response.body) {
      throw new Error("Response body is not available for streaming");
    }
    return response.body;
  }
  /**
   * Helper method to parse Server-Sent Events
   */
  async *parseServerSentEvents(stream) {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              return;
            }
            yield data;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  /**
   * Helper method to validate required parameters
   */
  validateRequired(params, requiredFields) {
    const missing = requiredFields.filter((field) => !params[field]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required parameters: ${missing.map(String).join(", ")}`
      );
    }
  }
  /**
   * Create a not implemented error for this provider
   */
  createNotImplementedError(feature) {
    return createNotImplementedError(this.key, feature);
  }
  /**
   * Type guard to check if an error is already normalized
   */
  isNormalizedError(error) {
    return typeof error === "object" && error !== null && "provider" in error && "type" in error && "message" in error && "retryable" in error;
  }
};

// src/providers/ollama.ts
var OllamaAdapter = class extends BaseProviderAdapter {
  key = "ollama";
  label = "Ollama";
  capabilities = {
    chat: true,
    embeddings: true,
    image: false,
    tools: false
  };
  host;
  defaultModel;
  constructor(config = {}) {
    super();
    this.host = config.host || process.env.OLLAMA_HOST || "http://localhost:11434";
    this.defaultModel = config.defaultModel || process.env.OLLAMA_MODEL || "llama2";
  }
  /**
   * Invoke chat completion with Ollama
   */
  async invokeChat(params) {
    this.validateRequired(params, ["messages"]);
    const model = params.model || this.defaultModel;
    const url = `${this.host}/api/chat`;
    const requestBody = {
      model,
      messages: params.messages,
      stream: false,
      options: {
        temperature: params.temperature,
        top_p: params.top_p,
        num_predict: params.max_tokens
      }
    };
    try {
      const response = await this.makeRequest(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();
      return {
        text: data.message.content,
        meta: {
          model: data.model,
          usage: {
            prompt_tokens: data.prompt_eval_count,
            completion_tokens: data.eval_count,
            total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
          },
          finish_reason: data.done ? "stop" : "length"
        }
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  /**
   * Invoke streaming chat completion with Ollama
   */
  async *invokeChatStream(params) {
    this.validateRequired(params, ["messages"]);
    const model = params.model || this.defaultModel;
    const url = `${this.host}/api/chat`;
    const requestBody = {
      model,
      messages: params.messages,
      stream: true,
      options: {
        temperature: params.temperature,
        top_p: params.top_p,
        num_predict: params.max_tokens
      }
    };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "entole/1.0.0"
        },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        const body = await safeParseJsonResponse(response);
        throw normalizeHttpError(response, this.key, body);
      }
      if (!response.body) {
        throw new Error("Response body is not available for streaming");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((line) => line.trim());
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.message?.content) {
                yield {
                  delta: data.message.content,
                  done: data.done,
                  meta: {
                    model: data.model
                  }
                };
              }
              if (data.done) {
                return;
              }
            } catch {
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  /**
   * Invoke embeddings with Ollama
   */
  async invokeEmbeddings(params) {
    this.validateRequired(params, ["input"]);
    const model = params.model || this.defaultModel;
    const url = `${this.host}/api/embeddings`;
    const inputs = Array.isArray(params.input) ? params.input : [params.input];
    const vectors = [];
    try {
      for (const input of inputs) {
        const requestBody = {
          model,
          prompt: input
        };
        const response = await this.makeRequest(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody)
        });
        const data = await response.json();
        vectors.push(data.embedding);
      }
      return {
        vectors,
        meta: {
          model,
          usage: {
            prompt_tokens: inputs.reduce((sum, input) => sum + input.length, 0),
            total_tokens: inputs.reduce((sum, input) => sum + input.length, 0)
          }
        }
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  /**
   * Get available models from Ollama
   */
  async getModels() {
    const url = `${this.host}/api/tags`;
    try {
      const response = await this.makeRequest(url);
      const data = await response.json();
      return data.models.map((model) => ({
        id: model.name,
        name: model.name,
        description: model.details?.family ? `${model.details.family} model` : void 0,
        capabilities: {
          chat: true,
          embeddings: true,
          image: false,
          tools: false
        }
      }));
    } catch {
      return [
        {
          id: this.defaultModel,
          name: this.defaultModel,
          description: "Default Ollama model",
          capabilities: this.capabilities
        }
      ];
    }
  }
  /**
   * Check if Ollama is available and healthy
   */
  async healthCheck() {
    try {
      const url = `${this.host}/api/tags`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "entole/1.0.0"
        },
        // Short timeout for health checks
        signal: AbortSignal.timeout(5e3)
      });
      if (response.ok) {
        return { healthy: true };
      } else {
        return {
          healthy: false,
          error: `Ollama returned HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          errorMessage = "Connection timeout";
        } else if (error.message.includes("fetch")) {
          errorMessage = "Connection failed";
        } else {
          errorMessage = error.message;
        }
      }
      return {
        healthy: false,
        error: `Ollama health check failed: ${errorMessage}`
      };
    }
  }
  /**
   * Normalize Ollama-specific errors
   */
  normalizeError(error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return {
        provider: this.key,
        type: "network",
        message: "Failed to connect to Ollama",
        hint: `Check that Ollama is running at ${this.host}. You can start it with 'ollama serve'.`,
        retryable: true
      };
    }
    if (error && typeof error === "object" && "httpStatus" in error) {
      const httpError = error;
      if (httpError.httpStatus === 404) {
        return {
          ...httpError,
          hint: `Model not found. Check available models with 'ollama list' or pull the model with 'ollama pull ${this.defaultModel}'.`
        };
      }
    }
    return super.normalizeError(error);
  }
};

// src/providers/openai.ts
var KNOWN_OPENAI_MODELS = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    description: "Most advanced multimodal model",
    capabilities: { chat: true, embeddings: false, image: true, tools: true }
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    description: "Fast and efficient model for simple tasks",
    capabilities: { chat: true, embeddings: false, image: true, tools: true }
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    description: "High-intelligence model for complex tasks",
    capabilities: { chat: true, embeddings: false, image: true, tools: true }
  },
  {
    id: "gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    description: "Fast and efficient model for most tasks",
    capabilities: { chat: true, embeddings: false, image: false, tools: true }
  },
  {
    id: "text-embedding-3-large",
    name: "Text Embedding 3 Large",
    description: "Most capable embedding model",
    capabilities: { chat: false, embeddings: true, image: false, tools: false }
  },
  {
    id: "text-embedding-3-small",
    name: "Text Embedding 3 Small",
    description: "Efficient embedding model",
    capabilities: { chat: false, embeddings: true, image: false, tools: false }
  },
  {
    id: "text-embedding-ada-002",
    name: "Text Embedding Ada 002",
    description: "Legacy embedding model",
    capabilities: { chat: false, embeddings: true, image: false, tools: false }
  }
];
var OpenAIAdapter = class extends BaseProviderAdapter {
  key = "openai";
  label = "OpenAI";
  capabilities = {
    chat: true,
    embeddings: true,
    image: true,
    tools: true
  };
  apiKey;
  baseUrl;
  defaultModel;
  constructor(config = {}) {
    super();
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";
    this.baseUrl = config.baseUrl || "https://api.openai.com";
    this.defaultModel = config.defaultModel || "gpt-4o-mini";
  }
  /**
   * Validate API key is available
   */
  validateApiKey() {
    if (!this.apiKey) {
      throw new Error(
        "OpenAI API key is required. Set OPENAI_API_KEY environment variable or provide apiKey in config."
      );
    }
  }
  /**
   * Invoke chat completion with OpenAI
   */
  async invokeChat(params) {
    this.validateApiKey();
    this.validateRequired(params, ["messages"]);
    const model = params.model || this.defaultModel;
    const url = `${this.baseUrl}/v1/chat/completions`;
    const requestBody = {
      model,
      messages: params.messages,
      temperature: params.temperature,
      top_p: params.top_p,
      max_tokens: params.max_tokens,
      stream: false
    };
    try {
      const response = await this.makeRequest(url, {
        method: "POST",
        headers: createHeaders(this.apiKey, "bearer"),
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();
      if (!data.choices || data.choices.length === 0) {
        throw new Error("No choices returned from OpenAI API");
      }
      const choice = data.choices[0];
      return {
        text: choice.message.content || "",
        meta: {
          model: data.model,
          usage: data.usage,
          finish_reason: choice.finish_reason || void 0
        }
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  /**
   * Invoke streaming chat completion with OpenAI
   */
  async *invokeChatStream(params) {
    this.validateApiKey();
    this.validateRequired(params, ["messages"]);
    const model = params.model || this.defaultModel;
    const url = `${this.baseUrl}/v1/chat/completions`;
    const requestBody = {
      model,
      messages: params.messages,
      temperature: params.temperature,
      top_p: params.top_p,
      max_tokens: params.max_tokens,
      stream: true
    };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: createHeaders(this.apiKey, "bearer"),
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        const body = await safeParseJsonResponse(response);
        throw normalizeHttpError(response, this.key, body);
      }
      if (!response.body) {
        throw new Error("Response body is not available for streaming");
      }
      for await (const eventData of this.parseServerSentEvents(response.body)) {
        try {
          const chunk = JSON.parse(eventData);
          if (chunk.choices && chunk.choices.length > 0) {
            const choice = chunk.choices[0];
            const content = choice.delta.content;
            if (content) {
              yield {
                delta: content,
                done: choice.finish_reason !== null,
                meta: {
                  model: chunk.model,
                  finish_reason: choice.finish_reason || void 0
                }
              };
            }
            if (choice.finish_reason !== null) {
              return;
            }
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  /**
   * Invoke embeddings with OpenAI
   */
  async invokeEmbeddings(params) {
    this.validateApiKey();
    this.validateRequired(params, ["input"]);
    const model = params.model || "text-embedding-3-small";
    const url = `${this.baseUrl}/v1/embeddings`;
    const requestBody = {
      model,
      input: params.input,
      encoding_format: "float"
    };
    try {
      const response = await this.makeRequest(url, {
        method: "POST",
        headers: createHeaders(this.apiKey, "bearer"),
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();
      if (!data.data || data.data.length === 0) {
        throw new Error("No embeddings returned from OpenAI API");
      }
      const sortedData = data.data.sort((a, b) => a.index - b.index);
      const vectors = sortedData.map((item) => item.embedding);
      return {
        vectors,
        meta: {
          model: data.model,
          usage: data.usage
        }
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  /**
   * Get available models from OpenAI
   */
  async getModels() {
    this.validateApiKey();
    const url = `${this.baseUrl}/v1/models`;
    try {
      const response = await this.makeRequest(url, {
        method: "GET",
        headers: createHeaders(this.apiKey, "bearer")
      });
      const data = await response.json();
      if (!data.data) {
        return KNOWN_OPENAI_MODELS;
      }
      const models = data.data.map((model) => {
        const isChat = model.id.includes("gpt") || model.id.includes("chat");
        const isEmbedding = model.id.includes("embedding") || model.id.includes("ada");
        const isImage = model.id.includes("gpt-4") && !model.id.includes("gpt-4-turbo-preview");
        const hasTools = isChat && !model.id.includes("gpt-3.5-turbo-instruct");
        return {
          id: model.id,
          name: model.id,
          description: `OpenAI ${model.id} model`,
          capabilities: {
            chat: isChat,
            embeddings: isEmbedding,
            image: isImage,
            tools: hasTools
          }
        };
      });
      return models;
    } catch {
      return KNOWN_OPENAI_MODELS;
    }
  }
  /**
   * Normalize OpenAI-specific errors
   */
  normalizeError(error) {
    if (error && typeof error === "object" && "httpStatus" in error) {
      const httpError = error;
      if (httpError.httpStatus === 401) {
        return {
          ...httpError,
          hint: "Check your OPENAI_API_KEY environment variable. Get your API key from https://platform.openai.com/api-keys"
        };
      }
      if (httpError.httpStatus === 429) {
        return {
          ...httpError,
          hint: "OpenAI rate limit exceeded. The request will be retried automatically. Consider upgrading your plan for higher limits."
        };
      }
      if (httpError.httpStatus === 400) {
        return {
          ...httpError,
          hint: "Check your request parameters. Ensure the model exists and your input is valid."
        };
      }
    }
    return super.normalizeError(error);
  }
};

// src/providers/anthropic.ts
var KNOWN_ANTHROPIC_MODELS = [
  {
    id: "claude-3-5-sonnet-20241022",
    name: "Claude 3.5 Sonnet",
    description: "Most intelligent model with best performance on complex tasks",
    capabilities: { chat: true, embeddings: false, image: true, tools: true }
  },
  {
    id: "claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    description: "Fastest model for everyday tasks",
    capabilities: { chat: true, embeddings: false, image: true, tools: true }
  },
  {
    id: "claude-3-opus-20240229",
    name: "Claude 3 Opus",
    description: "Most powerful model for highly complex tasks",
    capabilities: { chat: true, embeddings: false, image: true, tools: true }
  },
  {
    id: "claude-3-sonnet-20240229",
    name: "Claude 3 Sonnet",
    description: "Balance of intelligence and speed",
    capabilities: { chat: true, embeddings: false, image: true, tools: true }
  },
  {
    id: "claude-3-haiku-20240307",
    name: "Claude 3 Haiku",
    description: "Fast and cost-effective model",
    capabilities: { chat: true, embeddings: false, image: true, tools: true }
  }
];
var AnthropicAdapter = class extends BaseProviderAdapter {
  key = "anthropic";
  label = "Anthropic";
  capabilities = {
    chat: true,
    embeddings: false,
    // Anthropic doesn't support embeddings
    image: true,
    tools: true
  };
  apiKey;
  baseUrl;
  defaultModel;
  constructor(config = {}) {
    super();
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || "";
    this.baseUrl = "https://api.anthropic.com";
    this.defaultModel = config.defaultModel || "claude-3-5-sonnet-20241022";
  }
  /**
   * Validate API key is available
   */
  validateApiKey() {
    if (!this.apiKey) {
      throw new Error(
        "Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable or provide apiKey in config."
      );
    }
  }
  /**
   * Invoke chat completion with Anthropic Messages API
   */
  async invokeChat(params) {
    this.validateApiKey();
    this.validateRequired(params, ["messages"]);
    const model = params.model || this.defaultModel;
    const url = `${this.baseUrl}/v1/messages`;
    const { messages, system } = this.convertMessages(params.messages);
    const requestBody = {
      model,
      max_tokens: params.max_tokens || 4096,
      messages,
      system,
      temperature: params.temperature,
      top_p: params.top_p,
      stream: false
    };
    try {
      const response = await this.makeRequest(url, {
        method: "POST",
        headers: createHeaders(this.apiKey, "api-key", {
          "anthropic-version": "2023-06-01"
        }),
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();
      if (!data.content || data.content.length === 0) {
        throw new Error("No content returned from Anthropic API");
      }
      const text = data.content.filter((block) => block.type === "text").map((block) => block.text).join("");
      return {
        text,
        meta: {
          model: data.model,
          usage: {
            prompt_tokens: data.usage.input_tokens,
            completion_tokens: data.usage.output_tokens,
            total_tokens: data.usage.input_tokens + data.usage.output_tokens
          },
          finish_reason: data.stop_reason || void 0
        }
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  /**
   * Invoke streaming chat completion with Anthropic Messages API
   */
  async *invokeChatStream(params) {
    this.validateApiKey();
    this.validateRequired(params, ["messages"]);
    const model = params.model || this.defaultModel;
    const url = `${this.baseUrl}/v1/messages`;
    const { messages, system } = this.convertMessages(params.messages);
    const requestBody = {
      model,
      max_tokens: params.max_tokens || 4096,
      messages,
      system,
      temperature: params.temperature,
      top_p: params.top_p,
      stream: true
    };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: createHeaders(this.apiKey, "api-key", {
          "anthropic-version": "2023-06-01"
        }),
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        const body = await safeParseJsonResponse(response);
        throw normalizeHttpError(response, this.key, body);
      }
      if (!response.body) {
        throw new Error("Response body is not available for streaming");
      }
      let currentModel = model;
      let totalOutputTokens = 0;
      for await (const eventData of this.parseServerSentEvents(response.body)) {
        try {
          const event = JSON.parse(eventData);
          switch (event.type) {
            case "message_start":
              if (event.message?.model) {
                currentModel = event.message.model;
              }
              break;
            case "content_block_delta":
              if (event.delta?.text) {
                yield {
                  delta: event.delta.text,
                  done: false,
                  meta: {
                    model: currentModel
                  }
                };
              }
              break;
            case "message_delta":
              if (event.usage?.output_tokens) {
                totalOutputTokens = event.usage.output_tokens;
              }
              break;
            case "message_stop":
              yield {
                delta: "",
                done: true,
                meta: {
                  model: currentModel,
                  usage: {
                    completion_tokens: totalOutputTokens
                  },
                  finish_reason: "end_turn"
                }
              };
              return;
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  /**
   * Embeddings are not supported by Anthropic
   */
  async invokeEmbeddings(_params) {
    throw this.normalizeError({
      provider: this.key,
      type: "not_implemented",
      message: "Embeddings are not supported by Anthropic",
      hint: "Use OpenAI, OpenRouter, or Ollama for embedding capabilities",
      retryable: false
    });
  }
  /**
   * Get available models from Anthropic (returns known models)
   */
  async getModels() {
    return KNOWN_ANTHROPIC_MODELS;
  }
  /**
   * Convert OpenAI-style messages to Anthropic format
   * Anthropic requires alternating user/assistant messages and separate system parameter
   */
  convertMessages(messages) {
    let system;
    const anthropicMessages = [];
    for (const message of messages) {
      if (message.role === "system") {
        system = system ? `${system}

${message.content}` : message.content;
      } else if (message.role === "user" || message.role === "assistant") {
        anthropicMessages.push({
          role: message.role,
          content: message.content
        });
      }
    }
    if (anthropicMessages.length > 0 && anthropicMessages[0].role !== "user") {
      anthropicMessages.unshift({
        role: "user",
        content: "Hello"
      });
    }
    return { messages: anthropicMessages, system };
  }
  /**
   * Normalize Anthropic-specific errors
   */
  normalizeError(error) {
    if (error && typeof error === "object" && "httpStatus" in error) {
      const httpError = error;
      if (httpError.httpStatus === 401) {
        return {
          ...httpError,
          hint: "Check your ANTHROPIC_API_KEY environment variable. Get your API key from https://console.anthropic.com/"
        };
      }
      if (httpError.httpStatus === 429) {
        return {
          ...httpError,
          hint: "Anthropic rate limit exceeded. The request will be retried automatically. Consider upgrading your plan for higher limits."
        };
      }
      if (httpError.httpStatus === 400) {
        return {
          ...httpError,
          hint: "Check your request parameters. Ensure the model exists and your messages follow the correct format."
        };
      }
    }
    return super.normalizeError(error);
  }
};

// src/providers/openrouter.ts
var OpenRouterAdapter = class extends BaseProviderAdapter {
  key = "openrouter";
  label = "OpenRouter";
  capabilities = {
    chat: true,
    embeddings: true,
    image: false,
    // Depends on underlying model
    tools: false
    // Depends on underlying model
  };
  apiKey;
  baseUrl = "https://openrouter.ai/api";
  defaultModel;
  constructor(config = {}) {
    super();
    this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || "";
    this.defaultModel = config.defaultModel || "openai/gpt-3.5-turbo";
  }
  /**
   * Validate API key is available
   */
  validateApiKey() {
    if (!this.apiKey) {
      throw new Error(
        "OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable or provide apiKey in config."
      );
    }
  }
  /**
   * Create OpenRouter-specific headers with required HTTP-Referer and X-Title
   */
  createOpenRouterHeaders() {
    return createHeaders(this.apiKey, "bearer", {
      "HTTP-Referer": "https://github.com/metisse-ai/entole",
      "X-Title": "Entole CLI"
    });
  }
  /**
   * Invoke chat completion through OpenRouter proxy
   */
  async invokeChat(params) {
    this.validateApiKey();
    this.validateRequired(params, ["messages"]);
    const model = params.model || this.defaultModel;
    const url = `${this.baseUrl}/v1/chat/completions`;
    const requestBody = {
      model,
      messages: params.messages,
      temperature: params.temperature,
      top_p: params.top_p,
      max_tokens: params.max_tokens,
      stream: false
    };
    try {
      const response = await this.makeRequest(url, {
        method: "POST",
        headers: this.createOpenRouterHeaders(),
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();
      if (!data.choices || data.choices.length === 0) {
        throw new Error("No choices returned from OpenRouter API");
      }
      const choice = data.choices[0];
      return {
        text: choice.message.content || "",
        meta: {
          model: data.model,
          usage: data.usage,
          finish_reason: choice.finish_reason || void 0
        }
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  /**
   * Invoke streaming chat completion through OpenRouter proxy
   */
  async *invokeChatStream(params) {
    this.validateApiKey();
    this.validateRequired(params, ["messages"]);
    const model = params.model || this.defaultModel;
    const url = `${this.baseUrl}/v1/chat/completions`;
    const requestBody = {
      model,
      messages: params.messages,
      temperature: params.temperature,
      top_p: params.top_p,
      max_tokens: params.max_tokens,
      stream: true
    };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.createOpenRouterHeaders(),
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        const body = await safeParseJsonResponse(response);
        throw normalizeHttpError(response, this.key, body);
      }
      if (!response.body) {
        throw new Error("Response body is not available for streaming");
      }
      for await (const eventData of this.parseServerSentEvents(response.body)) {
        try {
          const chunk = JSON.parse(eventData);
          if (chunk.choices && chunk.choices.length > 0) {
            const choice = chunk.choices[0];
            const content = choice.delta.content;
            if (content) {
              yield {
                delta: content,
                done: choice.finish_reason !== null,
                meta: {
                  model: chunk.model,
                  finish_reason: choice.finish_reason || void 0
                }
              };
            }
            if (choice.finish_reason !== null) {
              return;
            }
          }
        } catch {
          continue;
        }
      }
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  /**
   * Invoke embeddings through OpenRouter proxy
   */
  async invokeEmbeddings(params) {
    this.validateApiKey();
    this.validateRequired(params, ["input"]);
    const model = params.model || "text-embedding-ada-002";
    const url = `${this.baseUrl}/v1/embeddings`;
    const requestBody = {
      model,
      input: params.input,
      encoding_format: "float"
    };
    try {
      const response = await this.makeRequest(url, {
        method: "POST",
        headers: this.createOpenRouterHeaders(),
        body: JSON.stringify(requestBody)
      });
      const data = await response.json();
      if (!data.data || data.data.length === 0) {
        throw new Error("No embeddings returned from OpenRouter API");
      }
      const sortedData = data.data.sort((a, b) => a.index - b.index);
      const vectors = sortedData.map((item) => item.embedding);
      return {
        vectors,
        meta: {
          model: data.model,
          usage: data.usage
        }
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  /**
   * Get available models from OpenRouter API
   */
  async getModels() {
    this.validateApiKey();
    const url = `${this.baseUrl}/v1/models`;
    try {
      const response = await this.makeRequest(url, {
        method: "GET",
        headers: this.createOpenRouterHeaders()
      });
      const data = await response.json();
      if (!data.data) {
        return [];
      }
      const models = data.data.map((model) => {
        const isChat = !model.id.includes("embedding") && !model.id.includes("whisper");
        const isEmbedding = model.id.includes("embedding");
        const isImage = model.id.includes("vision") || model.id.includes("gpt-4") || model.id.includes("claude-3");
        const hasTools = isChat && (model.id.includes("gpt-4") || model.id.includes("gpt-3.5-turbo") || model.id.includes("claude-3"));
        return {
          id: model.id,
          name: model.name || model.id,
          description: model.description || `OpenRouter ${model.id} model`,
          capabilities: {
            chat: isChat,
            embeddings: isEmbedding,
            image: isImage,
            tools: hasTools
          }
        };
      });
      return models;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  /**
   * Normalize OpenRouter-specific errors
   */
  normalizeError(error) {
    if (error && typeof error === "object" && "httpStatus" in error) {
      const httpError = error;
      if (httpError.httpStatus === 401) {
        return {
          ...httpError,
          hint: "Check your OPENROUTER_API_KEY environment variable. Get your API key from https://openrouter.ai/keys"
        };
      }
      if (httpError.httpStatus === 429) {
        return {
          ...httpError,
          hint: "OpenRouter rate limit exceeded. The request will be retried automatically. Consider upgrading your plan for higher limits."
        };
      }
      if (httpError.httpStatus === 400) {
        return {
          ...httpError,
          hint: "Check your request parameters. Ensure the model exists and is available through OpenRouter."
        };
      }
      if (httpError.httpStatus === 402) {
        return {
          ...httpError,
          type: "auth",
          hint: "Insufficient credits in your OpenRouter account. Add credits at https://openrouter.ai/credits"
        };
      }
    }
    return super.normalizeError(error);
  }
};

// src/providers/mistral.ts
var MistralAdapter = class extends BaseProviderAdapter {
  key = "mistral";
  label = "Mistral";
  capabilities = {
    chat: false,
    embeddings: false,
    image: false,
    tools: false
  };
  constructor(_config = {}) {
    super();
  }
  /**
   * Chat is not yet implemented for Mistral
   */
  async invokeChat(_params) {
    throw createNotImplementedError(this.key, "chat");
  }
  /**
   * Streaming chat is not yet implemented for Mistral
   */
  async *invokeChatStream(_params) {
    yield { delta: "", done: true };
    throw createNotImplementedError(this.key, "streaming chat");
  }
  /**
   * Embeddings are not yet implemented for Mistral
   */
  async invokeEmbeddings(_params) {
    throw createNotImplementedError(this.key, "embeddings");
  }
  /**
   * Model listing is not yet implemented for Mistral
   */
  async getModels() {
    return [];
  }
};

// src/providers/cohere.ts
var CohereAdapter = class extends BaseProviderAdapter {
  key = "cohere";
  label = "Cohere";
  capabilities = {
    chat: false,
    embeddings: false,
    image: false,
    tools: false
  };
  constructor(_config = {}) {
    super();
  }
  /**
   * Chat is not yet implemented for Cohere
   */
  async invokeChat(_params) {
    throw createNotImplementedError(this.key, "chat");
  }
  /**
   * Streaming chat is not yet implemented for Cohere
   */
  async *invokeChatStream(_params) {
    yield { delta: "", done: true };
    throw createNotImplementedError(this.key, "streaming chat");
  }
  /**
   * Embeddings are not yet implemented for Cohere
   */
  async invokeEmbeddings(_params) {
    throw createNotImplementedError(this.key, "embeddings");
  }
  /**
   * Model listing is not yet implemented for Cohere
   */
  async getModels() {
    return [];
  }
};

// src/providers/index.ts
function initializeProviders() {
  registerProvider(new OllamaAdapter());
  registerProvider(new OpenAIAdapter());
  registerProvider(new AnthropicAdapter());
  registerProvider(new OpenRouterAdapter());
  registerProvider(new MistralAdapter());
  registerProvider(new CohereAdapter());
}
initializeProviders();

// src/commands/chat.ts
var chatCommand = new Command("chat").description("Chat with an AI provider").argument("[prompt]", "The prompt to send to the AI (or use --file)").option(
  "-p, --provider <provider>",
  "AI provider to use (openai, anthropic, ollama, openrouter)"
).option("-m, --model <model>", "Model to use").option(
  "-f, --file <file>",
  "Read prompt from file (use @filename in prompt for inline file reading)"
).option("-s, --stream", "Stream the response", false).option(
  "-t, --temperature <temp>",
  "Temperature for response generation",
  parseFloat
).option("--top-p <top_p>", "Top-p for response generation", parseFloat).option("--max-tokens <tokens>", "Maximum tokens to generate", parseInt).option("--json", "Output in JSON format", false).action(async (prompt, options) => {
  const startTime = Date.now();
  let configLoadTime = 0;
  let providerTime = 0;
  const outputFormat = getOutputFormat(options.json);
  try {
    const configStart = Date.now();
    const { config } = await loadConfig({
      cliFlags: {
        provider: options.provider,
        model: options.model,
        temperature: options.temperature,
        top_p: options.topP,
        max_tokens: options.maxTokens,
        json: options.json,
        stream: options.stream
      }
    });
    configLoadTime = Date.now() - configStart;
    const timingsEnabled = config.observability?.timings ?? false;
    initializeTimings(timingsEnabled);
    let promptText = prompt;
    if (options.file) {
      if (!existsSync2(options.file)) {
        throw new Error(`File not found: ${options.file}`);
      }
      promptText = readFileSync2(options.file, "utf-8").trim();
    } else if (promptText && promptText.startsWith("@")) {
      const filename = promptText.slice(1);
      if (!existsSync2(filename)) {
        throw new Error(`File not found: ${filename}`);
      }
      promptText = readFileSync2(filename, "utf-8").trim();
    }
    if (!promptText) {
      throw new Error(
        "No prompt provided. Use a prompt argument, --file option, or @filename syntax."
      );
    }
    const providerKey = options.provider || config.providers?.default?.chat || "openai";
    const provider = providerRegistry.resolve(providerKey, "chat");
    let model = options.model;
    if (!model && config.providers) {
      const providerConfig = config.providers[providerKey];
      if (providerConfig && typeof providerConfig === "object" && "defaultModel" in providerConfig) {
        model = providerConfig.defaultModel;
      }
    }
    const chatParams = {
      model,
      messages: [{ role: "user", content: promptText }],
      temperature: options.temperature,
      top_p: options.topP,
      max_tokens: options.maxTokens
    };
    const providerStart = Date.now();
    const timingsMs = () => ({
      total: Date.now() - startTime,
      provider: providerTime,
      config: configLoadTime
    });
    if (options.stream) {
      if (outputFormat === "json") {
        const streamingOutput = new StreamingJsonOutput(
          provider.key,
          model,
          timingsMs()
        );
        try {
          await withTiming(
            async () => {
              for await (const chunk of provider.invokeChatStream(
                chatParams
              )) {
                streamingOutput.processChunk(chunk);
              }
              return { text: "streaming_complete" };
            },
            {
              command: "chat",
              provider: provider.key,
              model
            }
          );
          providerTime = Date.now() - providerStart;
          const result = streamingOutput.finalize();
          outputContent(result, outputFormat);
        } catch (streamError) {
          const normalizedError = provider.normalizeError(streamError);
          const errorResult = streamingOutput.handleError(normalizedError);
          outputError(errorResult, outputFormat);
          process.exit(1);
        }
      } else {
        const streamingOutput = new StreamingOutput();
        try {
          await withTiming(
            async () => {
              for await (const chunk of provider.invokeChatStream(
                chatParams
              )) {
                streamingOutput.processChunk(chunk);
              }
              return { text: "streaming_complete" };
            },
            {
              command: "chat",
              provider: provider.key,
              model
            }
          );
          providerTime = Date.now() - providerStart;
        } catch (streamError) {
          const normalizedError = provider.normalizeError(streamError);
          streamingOutput.handleError(normalizedError);
          process.exit(1);
        }
      }
    } else {
      const response = await withTiming(
        () => provider.invokeChat(chatParams),
        {
          command: "chat",
          provider: provider.key,
          model
        }
      );
      providerTime = Date.now() - providerStart;
      if (outputFormat === "json") {
        const result = formatChatResponseJson(
          response,
          provider.key,
          model,
          timingsMs()
        );
        outputContent(result, outputFormat);
      } else {
        const result = formatChatResponse(response, provider.key, model);
        outputContent(result, outputFormat);
      }
    }
  } catch (error) {
    const totalTime = Date.now() - startTime;
    let normalizedError;
    if (error && typeof error === "object" && "provider" in error && "type" in error) {
      normalizedError = error;
    } else {
      normalizedError = {
        provider: "unknown",
        type: "internal",
        message: error instanceof Error ? error.message : String(error),
        retryable: false
      };
    }
    const timingsMs = {
      total: totalTime,
      provider: providerTime,
      config: configLoadTime
    };
    if (outputFormat === "json") {
      const errorResult = formatErrorJson(
        "chat",
        normalizedError,
        normalizedError.provider,
        void 0,
        timingsMs
      );
      outputError(errorResult, outputFormat);
    } else {
      const errorResult = formatError(normalizedError);
      outputError(errorResult, outputFormat);
    }
    process.exit(1);
  }
});

// src/commands/embed.ts
import { Command as Command2 } from "commander";
import { readFileSync as readFileSync3, existsSync as existsSync3 } from "fs";
var embedCommand = new Command2("embed").description("Generate embeddings for text").argument("<input>", "Text to embed (or @filename to read from file)").option(
  "-p, --provider <provider>",
  "AI provider to use (openai, ollama, openrouter)"
).option("-m, --model <model>", "Model to use for embeddings").option("--json", "Output in JSON format", false).action(async (input, options) => {
  const startTime = Date.now();
  let configLoadTime = 0;
  let providerTime = 0;
  const outputFormat = getOutputFormat(options.json);
  try {
    const configStart = Date.now();
    const { config } = await loadConfig({
      cliFlags: {
        provider: options.provider,
        model: options.model,
        json: options.json
      }
    });
    configLoadTime = Date.now() - configStart;
    const timingsEnabled = config.observability?.timings ?? false;
    initializeTimings(timingsEnabled);
    let inputText = input;
    if (input.startsWith("@")) {
      const filename = input.slice(1);
      if (!existsSync3(filename)) {
        throw new Error(`File not found: ${filename}`);
      }
      inputText = readFileSync3(filename, "utf-8").trim();
    }
    if (!inputText) {
      throw new Error("No input text provided.");
    }
    const providerKey = options.provider || config.providers?.default?.embeddings || "openai";
    const provider = providerRegistry.resolve(providerKey, "embeddings");
    let model = options.model;
    if (!model && config.providers) {
      const providerConfig = config.providers[providerKey];
      if (providerConfig && typeof providerConfig === "object" && "defaultModel" in providerConfig) {
        model = providerConfig.defaultModel;
      }
    }
    const embeddingParams = {
      model,
      input: inputText
    };
    const providerStart = Date.now();
    const response = await withTiming(
      () => provider.invokeEmbeddings(embeddingParams),
      {
        command: "embed",
        provider: provider.key,
        model
      }
    );
    providerTime = Date.now() - providerStart;
    const timingsMs = {
      total: Date.now() - startTime,
      provider: providerTime,
      config: configLoadTime
    };
    if (outputFormat === "json") {
      const result = formatEmbeddingResponseJson(
        response,
        provider.key,
        model,
        timingsMs
      );
      outputContent(result, outputFormat);
    } else {
      const result = formatEmbeddingResponse(response, provider.key, model);
      outputContent(result, outputFormat);
    }
  } catch (error) {
    const totalTime = Date.now() - startTime;
    let normalizedError;
    if (error && typeof error === "object" && "provider" in error && "type" in error) {
      normalizedError = error;
    } else {
      normalizedError = {
        provider: "unknown",
        type: "internal",
        message: error instanceof Error ? error.message : String(error),
        retryable: false
      };
    }
    const timingsMs = {
      total: totalTime,
      provider: providerTime,
      config: configLoadTime
    };
    if (outputFormat === "json") {
      const errorResult = formatErrorJson(
        "embed",
        normalizedError,
        normalizedError.provider,
        void 0,
        timingsMs
      );
      outputError(errorResult, outputFormat);
    } else {
      const errorResult = formatError(normalizedError);
      outputError(errorResult, outputFormat);
    }
    process.exit(1);
  }
});

// src/commands/providers.ts
import { Command as Command3 } from "commander";
var providersCommand = new Command3("providers").description(
  "Manage AI providers"
);
providersCommand.command("list").description("List available providers and their capabilities").option("--json", "Output in JSON format", false).action(async (options) => {
  const startTime = Date.now();
  let configLoadTime = 0;
  const outputFormat = getOutputFormat(options.json);
  try {
    const configStart = Date.now();
    const { config } = await loadConfig({
      cliFlags: {
        json: options.json
      }
    });
    configLoadTime = Date.now() - configStart;
    const providers = providerRegistry.getProviderInfo();
    const timingsMs = {
      total: Date.now() - startTime,
      provider: 0,
      config: configLoadTime
    };
    if (outputFormat === "json") {
      const result = formatProviderListJson(providers, timingsMs);
      outputContent(result, outputFormat);
    } else {
      const result = formatProviderList(providers);
      outputContent(result, outputFormat);
      if (config.providers?.default?.chat || config.providers?.default?.embeddings) {
        outputContent("\nCurrent Defaults:", outputFormat);
        if (config.providers.default.chat) {
          outputContent(
            `  Chat: ${config.providers.default.chat}`,
            outputFormat
          );
        }
        if (config.providers.default.embeddings) {
          outputContent(
            `  Embeddings: ${config.providers.default.embeddings}`,
            outputFormat
          );
        }
      } else {
        outputContent(
          "\nNo default providers configured. Will use first available provider for each capability.",
          outputFormat
        );
      }
    }
  } catch (error) {
    const totalTime = Date.now() - startTime;
    let normalizedError;
    if (error && typeof error === "object" && "provider" in error && "type" in error) {
      normalizedError = error;
    } else {
      normalizedError = {
        provider: "unknown",
        type: "internal",
        message: error instanceof Error ? error.message : String(error),
        retryable: false
      };
    }
    const timingsMs = {
      total: totalTime,
      provider: 0,
      config: configLoadTime
    };
    if (outputFormat === "json") {
      const errorResult = formatErrorJson(
        "providers",
        normalizedError,
        normalizedError.provider,
        void 0,
        timingsMs
      );
      outputError(errorResult, outputFormat);
    } else {
      const errorResult = formatError(normalizedError);
      outputError(errorResult, outputFormat);
    }
    process.exit(1);
  }
});

// src/commands/doctor.ts
import { Command as Command4 } from "commander";
var doctorCommand = new Command4("doctor").description("Validate configuration and provider setup").option("--json", "Output results in JSON format").action(async (options) => {
  const outputFormat = getOutputFormat(options.json);
  try {
    const result = await runDoctorChecks();
    if (outputFormat === "json") {
      const jsonResult = {
        configValid: result.ok,
        providers: result.checks.filter(
          (check) => check.name.includes("Environment") || check.name.includes("Connectivity") || check.name.includes("API Key")
        ).map((check) => ({
          key: check.name.toLowerCase().split(" ")[0],
          available: check.status === "pass",
          error: check.status === "fail" ? check.message : void 0,
          hint: check.hint
        })),
        issues: result.checks.filter((check) => check.status === "fail").map(
          (check) => `${check.name}: ${check.message}${check.hint ? ` (${check.hint})` : ""}`
        )
      };
      const jsonOutput = formatDoctorResultsJson(jsonResult);
      outputContent(jsonOutput, outputFormat);
    } else {
      printHumanReadableResults(result);
    }
    if (!result.ok) {
      process.exit(1);
    }
  } catch (error) {
    const normalizedError = {
      provider: "doctor",
      type: "internal",
      message: error instanceof Error ? error.message : String(error),
      retryable: false
    };
    if (outputFormat === "json") {
      const errorResult = formatErrorJson("doctor", normalizedError);
      outputError(errorResult, outputFormat);
    } else {
      const errorResult = formatError(normalizedError);
      outputError(errorResult, outputFormat);
    }
    process.exit(1);
  }
});
async function runDoctorChecks() {
  const checks = [];
  await checkConfiguration(checks);
  checkEnvironmentVariables(checks);
  await checkProviderConnectivity(checks);
  const hasFailures = checks.some((check) => check.status === "fail");
  return {
    ok: !hasFailures,
    checks
  };
}
async function checkConfiguration(checks) {
  try {
    const configResult = await loadConfig();
    checks.push({
      name: "Configuration Loading",
      status: "pass",
      message: "Configuration loaded successfully"
    });
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
        name: "Configuration Sources",
        status: "pass",
        message: `Found: ${sources.join(", ")}`
      });
    } else {
      checks.push({
        name: "Configuration Sources",
        status: "warn",
        message: "No configuration sources found, using defaults",
        hint: "Consider creating an entole.config.json file or setting environment variables"
      });
    }
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      checks.push({
        name: "Configuration Validation",
        status: "fail",
        message: "Configuration validation failed",
        hint: `Issues found: ${error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`
      });
    } else if (error instanceof ConfigFileError) {
      checks.push({
        name: "Configuration File",
        status: "fail",
        message: "Failed to parse configuration file",
        hint: error.cause
      });
    } else {
      checks.push({
        name: "Configuration Loading",
        status: "fail",
        message: "Unexpected error loading configuration",
        hint: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
function checkEnvironmentVariables(checks) {
  const providerEnvVars = {
    openai: ["OPENAI_API_KEY"],
    anthropic: ["ANTHROPIC_API_KEY"],
    openrouter: ["OPENROUTER_API_KEY"],
    ollama: ["OLLAMA_HOST", "OLLAMA_MODEL"]
  };
  for (const [provider, envVars] of Object.entries(providerEnvVars)) {
    const foundVars = envVars.filter((envVar) => process.env[envVar]);
    const missingVars = envVars.filter((envVar) => !process.env[envVar]);
    if (foundVars.length === envVars.length) {
      checks.push({
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Environment`,
        status: "pass",
        message: `All required environment variables found: ${foundVars.join(", ")}`
      });
    } else if (foundVars.length > 0) {
      checks.push({
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Environment`,
        status: "warn",
        message: `Some environment variables found: ${foundVars.join(", ")}`,
        hint: `Missing optional variables: ${missingVars.join(", ")}`
      });
    } else {
      const isRequired = provider !== "ollama";
      checks.push({
        name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Environment`,
        status: isRequired ? "fail" : "warn",
        message: `No environment variables found for ${provider}`,
        hint: `Set ${missingVars.join(" and/or ")} to use ${provider}`
      });
    }
  }
  const knownEnvVars = new Set(Object.keys(ENV_VAR_MAPPING));
  const suspiciousVars = Object.keys(process.env).filter(
    (key) => (key.startsWith("ENTOLE_") || key.includes("OPENAI") || key.includes("ANTHROPIC") || key.includes("OLLAMA") || key.includes("OPENROUTER")) && !knownEnvVars.has(key)
  );
  if (suspiciousVars.length > 0) {
    checks.push({
      name: "Environment Variable Typos",
      status: "warn",
      message: `Found potentially misspelled environment variables: ${suspiciousVars.join(", ")}`,
      hint: `Check spelling against known variables: ${Array.from(knownEnvVars).join(", ")}`
    });
  }
}
async function checkProviderConnectivity(checks) {
  const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL;
  try {
    const ollama = new OllamaAdapter({
      host: ollamaHost,
      defaultModel: ollamaModel
    });
    const healthResult = await ollama.healthCheck();
    if (healthResult.healthy) {
      checks.push({
        name: "Ollama Connectivity",
        status: "pass",
        message: `Successfully connected to Ollama at ${ollamaHost}`
      });
      try {
        const models = await ollama.getModels();
        if (models.length > 0) {
          checks.push({
            name: "Ollama Models",
            status: "pass",
            message: `Found ${models.length} available models: ${models.slice(0, 3).map((m) => m.name).join(", ")}${models.length > 3 ? "..." : ""}`
          });
        } else {
          checks.push({
            name: "Ollama Models",
            status: "warn",
            message: "No models found in Ollama",
            hint: "Pull a model with: ollama pull llama2"
          });
        }
      } catch (error) {
        checks.push({
          name: "Ollama Models",
          status: "warn",
          message: "Could not retrieve model list",
          hint: error instanceof Error ? error.message : String(error)
        });
      }
    } else {
      checks.push({
        name: "Ollama Connectivity",
        status: "fail",
        message: `Cannot connect to Ollama at ${ollamaHost}`,
        hint: healthResult.error || "Check that Ollama is running with: ollama serve"
      });
    }
  } catch (error) {
    checks.push({
      name: "Ollama Connectivity",
      status: "fail",
      message: "Failed to test Ollama connectivity",
      hint: error instanceof Error ? error.message : String(error)
    });
  }
  const apiKeyProviders = [
    { name: "OpenAI", envVar: "OPENAI_API_KEY" },
    { name: "Anthropic", envVar: "ANTHROPIC_API_KEY" },
    { name: "OpenRouter", envVar: "OPENROUTER_API_KEY" }
  ];
  for (const { name, envVar } of apiKeyProviders) {
    const apiKey = process.env[envVar];
    if (apiKey) {
      let isValidFormat = false;
      let hint = "";
      if (name === "OpenAI" && apiKey.startsWith("sk-") && apiKey.length >= 20) {
        isValidFormat = true;
      } else if (name === "Anthropic" && apiKey.startsWith("sk-ant-") && apiKey.length >= 20) {
        isValidFormat = true;
      } else if (name === "OpenRouter" && apiKey.length >= 20) {
        isValidFormat = true;
      } else {
        hint = `API key format appears invalid for ${name}`;
      }
      checks.push({
        name: `${name} API Key`,
        status: isValidFormat ? "pass" : "warn",
        message: isValidFormat ? `${name} API key is present and appears valid` : `${name} API key is present but format is questionable`,
        hint: hint || void 0
      });
    }
  }
}
function printHumanReadableResults(result) {
  console.log("\u{1F3E5} Entole Configuration Doctor\n");
  const passCount = result.checks.filter((c) => c.status === "pass").length;
  const warnCount = result.checks.filter((c) => c.status === "warn").length;
  const failCount = result.checks.filter((c) => c.status === "fail").length;
  for (const check of result.checks) {
    const icon = check.status === "pass" ? "\u2705" : check.status === "warn" ? "\u26A0\uFE0F" : "\u274C";
    console.log(`${icon} ${check.name}: ${check.message}`);
    if (check.hint) {
      console.log(`   \u{1F4A1} ${check.hint}`);
    }
    console.log();
  }
  console.log("\u{1F4CA} Summary:");
  console.log(`   \u2705 ${passCount} passed`);
  if (warnCount > 0) {
    console.log(`   \u26A0\uFE0F  ${warnCount} warnings`);
  }
  if (failCount > 0) {
    console.log(`   \u274C ${failCount} failed`);
  }
  if (result.ok) {
    console.log("\n\u{1F389} All critical checks passed! Entole is ready to use.");
  } else {
    console.log(
      "\n\u{1F6A8} Some checks failed. Please address the issues above before using Entole."
    );
  }
}

// src/index.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var packageJson = JSON.parse(
  readFileSync4(join3(__dirname, "../package.json"), "utf-8")
);
var program = new Command5();
program.name("entole").description("Multi-provider AI CLI for chat and embeddings by Metisse").version(packageJson.version);
program.addCommand(chatCommand);
program.addCommand(embedCommand);
program.addCommand(providersCommand);
program.addCommand(doctorCommand);
process.on("exit", () => {
  closeTimings().catch(() => {
  });
});
process.on("SIGINT", async () => {
  await closeTimings();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await closeTimings();
  process.exit(0);
});
program.parse();
export {
  AnthropicAdapter,
  BaseProviderAdapter,
  CohereAdapter,
  MistralAdapter,
  OllamaAdapter,
  OpenAIAdapter,
  OpenRouterAdapter,
  ProviderRegistry,
  closeTimings,
  createHeaders,
  createNotImplementedError,
  getProvider,
  getProviderInfo,
  getTimingCollector,
  initializeTimings,
  normalizeHttpError,
  normalizeNetworkError,
  providerRegistry,
  registerProvider,
  resolveProvider,
  safeParseJsonResponse,
  validateRequiredConfig,
  withTiming
};
//# sourceMappingURL=index.js.map