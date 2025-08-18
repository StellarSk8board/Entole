/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright 2024 Metisse
 */

/**
 * Comprehensive secret redaction patterns for various API keys and sensitive data
 */

// Common API key patterns - order matters for specificity
const API_KEY_PATTERNS = [
  // OpenAI keys (most specific first)
  /sk-[a-zA-Z0-9]{48}/g,
  /sk-proj-[a-zA-Z0-9]{48}/g,

  // Anthropic keys
  /sk-ant-[a-zA-Z0-9-]{95}/g,

  // OpenRouter keys
  /sk-or-[a-zA-Z0-9-]{48}/g,

  // Generic Bearer tokens
  /Bearer\s+[a-zA-Z0-9-_]{20,}/g,

  // AWS keys
  /AKIA[0-9A-Z]{16}/g,

  // Google Cloud keys
  /AIza[0-9A-Za-z-_]{35}/g,

  // GitHub tokens
  /gh[pousr]_[A-Za-z0-9_]{36}/g,
  /github_pat_[a-zA-Z0-9_]{82}/g,

  // Generic API keys (various formats) - less specific patterns last
  /api[_-]?key["\s:=]+[a-zA-Z0-9-_]{16,}/gi,
  /token["\s:=]+[a-zA-Z0-9-_]{16,}/gi,
  /secret["\s:=]+[a-zA-Z0-9-_]{16,}/gi,

  // AWS secret access keys (40 chars base64-like)
  /[a-zA-Z0-9/+=]{40}/g,

  // Generic long alphanumeric strings that might be keys (least specific)
  /[a-zA-Z0-9]{32,}/g,
];

// Email patterns (for privacy)
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/**
 * Redacts secrets and sensitive information from text
 */
export function redactSecrets(text: string): string {
  let redacted = text;

  // Process patterns in order of specificity - most specific first
  // OpenAI keys
  redacted = redacted.replace(/sk-[a-zA-Z0-9]{48}/g, 'sk-****');
  redacted = redacted.replace(/sk-proj-[a-zA-Z0-9]{48}/g, 'sk-proj-****');

  // Anthropic keys (flexible length match)
  redacted = redacted.replace(/sk-ant-[a-zA-Z0-9-]{90,100}/g, 'sk-ant-****');

  // OpenRouter keys
  redacted = redacted.replace(/sk-or-[a-zA-Z0-9-]{48}/g, 'sk-or-****');

  // Bearer tokens
  redacted = redacted.replace(/Bearer\s+[a-zA-Z0-9-_]{20,}/g, 'Bearer ****');

  // AWS keys
  redacted = redacted.replace(/AKIA[0-9A-Z]{16}/g, 'AKIA****');

  // Google Cloud keys
  redacted = redacted.replace(/AIza[0-9A-Za-z-_]{35}/g, 'AIza****');

  // GitHub tokens - flexible length patterns
  redacted = redacted.replace(/ghp_[A-Za-z0-9_]{36,}/g, 'ghp_****');
  redacted = redacted.replace(/gho_[A-Za-z0-9_]{36,}/g, 'gho_****');
  redacted = redacted.replace(/ghu_[A-Za-z0-9_]{36,}/g, 'ghu_****');
  redacted = redacted.replace(/ghs_[A-Za-z0-9_]{36,}/g, 'ghs_****');
  redacted = redacted.replace(/ghr_[A-Za-z0-9_]{36,}/g, 'ghr_****');
  redacted = redacted.replace(
    /github_pat_[a-zA-Z0-9_]{82,}/g,
    'github_pat_****'
  );

  // Redact sensitive URL parameters
  redacted = redacted.replace(
    /(\?|&)(token|key|secret|auth)=[^&\s]+/gi,
    '$1$2=****'
  );

  // Generic long alphanumeric strings (32+ chars) - very conservative
  // Do this before generic key-value patterns to avoid conflicts
  redacted = redacted.replace(
    /(?<![a-zA-Z0-9_])[a-zA-Z0-9]{32,}(?![a-zA-Z0-9_])/g,
    (match) => {
      // Skip if it's already been redacted, looks like normal text, or is all numbers
      if (
        match.includes('*') ||
        /^[0-9]+$/.test(match) ||
        /^[a-zA-Z]+$/.test(match) ||
        // Skip if it looks like a GitHub token that should be handled by specific patterns
        match.startsWith('github_pat_') ||
        match.startsWith('ghp_') ||
        match.startsWith('gho_') ||
        match.startsWith('ghu_') ||
        match.startsWith('ghs_') ||
        match.startsWith('ghr_')
      ) {
        return match;
      }
      return match.substring(0, 4) + '****';
    }
  );

  // Generic API key patterns - handle key=value format carefully
  // Only match if not already redacted by specific patterns above
  redacted = redacted.replace(
    /(^|[^a-zA-Z0-9])(secret|token|key)(\s*[:=]\s*)([a-zA-Z0-9-_]{8,})(?!\*)/gi,
    (_match, prefix, keyName, separator, value) => {
      // Don't redact if the value is already redacted
      if (value.includes('*')) {
        return prefix + keyName + separator + value;
      }
      return prefix + keyName + separator + '****';
    }
  );

  return redacted;
}

/**
 * Redacts personally identifiable information (PII)
 */
export function redactPII(text: string): string {
  let redacted = text;

  // Redact email addresses
  redacted = redacted.replace(EMAIL_PATTERN, (match) => {
    const [local, domain] = match.split('@');
    if (local.length <= 2) return '****@' + domain;
    return local.substring(0, 2) + '****@' + domain;
  });

  // Redact US phone numbers - preserve surrounding spaces
  redacted = redacted.replace(
    /(\s|^)\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}(\s|$)/g,
    (_match, before, after) => {
      return before + '***-***-****' + after;
    }
  );

  // Handle international numbers - preserve surrounding context
  redacted = redacted.replace(
    /(\s|^)\+[1-9][\d\s-]{7,14}(\s|$)/g,
    (_match, before, after) => {
      return before + '***-***-****' + after;
    }
  );

  return redacted;
}

/**
 * Comprehensive redaction that combines secrets and PII
 */
export function redactSensitiveData(text: string): string {
  return redactPII(redactSecrets(text));
}

/**
 * Redacts sensitive data from objects (recursively)
 */
export function redactObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return redactSensitiveData(obj) as T;
  }

  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => {
      if (typeof item === 'string') {
        return redactSecrets(item);
      }
      return redactObject(item);
    }) as T;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Redact known sensitive field names
    if (isSensitiveField(key)) {
      redacted[key] = '****';
    } else {
      redacted[key] = redactObject(value);
    }
  }

  return redacted as T;
}

/**
 * Checks if a field name indicates sensitive data
 */
function isSensitiveField(fieldName: string): boolean {
  const sensitiveFields = [
    'password',
    'passwd',
    'secret',
    'token',
    'apikey',
    'api_key',
    'auth',
    'authorization',
    'credential',
    'credentials',
    'private',
    'confidential',
  ];

  const lowerField = fieldName.toLowerCase();

  // Exact matches for common patterns
  if (sensitiveFields.includes(lowerField)) {
    return true;
  }

  // Special case for 'key' and 'token' - only match if it's the whole word or part of compound words
  if (
    lowerField === 'key' ||
    lowerField.endsWith('_key') ||
    lowerField.endsWith('-key') ||
    lowerField.startsWith('key_') ||
    lowerField.startsWith('key-')
  ) {
    return true;
  }

  if (
    lowerField === 'token' ||
    lowerField.endsWith('_token') ||
    lowerField.endsWith('-token') ||
    lowerField.startsWith('token_') ||
    lowerField.startsWith('token-')
  ) {
    return true;
  }

  // Check for other sensitive patterns (excluding 'key' and 'token' to avoid false positives)
  const otherSensitiveFields = sensitiveFields.filter(
    (field) => field !== 'key' && field !== 'token'
  );
  return otherSensitiveFields.some((sensitive) =>
    lowerField.includes(sensitive)
  );
}

/**
 * Safe JSON stringify that redacts sensitive data
 */
export function safeStringify(obj: unknown, space?: number): string {
  try {
    const redacted = redactObject(obj);
    return JSON.stringify(redacted, null, space);
  } catch {
    return '[Unable to serialize object safely]';
  }
}

/**
 * Creates a safe error message for logging
 */
export function createSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return redactSensitiveData(error.message);
  }

  if (typeof error === 'string') {
    return redactSensitiveData(error);
  }

  if (typeof error === 'object' && error !== null) {
    return safeStringify(error);
  }

  return 'Unknown error occurred';
}

/**
 * Validates that text doesn't contain obvious secrets (for testing)
 */
export function containsSecrets(text: string): boolean {
  // Check for common API key patterns
  const hasApiKey = API_KEY_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0; // Reset regex state
    return pattern.test(text);
  });

  if (hasApiKey) return true;

  // Check for Bearer tokens
  if (/Bearer\s+[a-zA-Z0-9-_]{20,}/.test(text)) return true;

  // Check for long base64-like strings that might be keys
  if (/[A-Za-z0-9+/]{40,}={0,2}/.test(text)) return true;

  return false;
}
