# Entole CLI Architecture Overview

This document provides a high-level overview of the Entole CLI's architecture.

## Core components

The Entole CLI is a single-package application with a modular architecture:

1.  **Command Layer (`src/commands/`):**
    - **Purpose:** Handles user-facing CLI commands (chat, embed, providers, doctor)
    - **Key functions:**
      - Command parsing and validation
      - Input/output formatting
      - Error handling and user feedback

2.  **Provider Layer (`src/providers/`):**
    - **Purpose:** Abstracts different AI providers behind a unified interface
    - **Key functions:**
      - Provider adapters for OpenAI, Anthropic, Ollama, OpenRouter
      - Request/response normalization
      - Error handling and retry logic
      - Model capability detection

3.  **Configuration Layer (`src/config/`):**
    - **Purpose:** Manages configuration loading and validation
    - **Key functions:**
      - Environment variable processing
      - Config file parsing (JSON/YAML)
      - CLI flag handling
      - Configuration precedence and merging

4.  **Output Layer (`src/output/`):**
    - **Purpose:** Handles response formatting and display
    - **Key functions:**
      - Human-readable formatting
      - JSON envelope generation
      - Streaming output support
      - Error message formatting

## Interaction Flow

A typical interaction with the Entole CLI follows this flow:

1.  **User input:** The user invokes a command (chat, embed, etc.) with parameters
2.  **Configuration loading:** The system loads configuration from environment variables, config files, and CLI flags
3.  **Provider resolution:** Based on configuration, the appropriate AI provider is selected and initialized
4.  **Request processing:** The command handler:
    - Validates and processes input parameters
    - Constructs the appropriate request for the selected provider
    - Handles file input if specified (@filename syntax)
5.  **Provider interaction:** The provider adapter:
    - Formats the request according to the provider's API requirements
    - Makes the HTTP request to the provider's API
    - Handles authentication, rate limiting, and error responses
6.  **Response processing:** The system:
    - Normalizes the provider's response to a common format
    - Applies any necessary transformations or filtering
    - Records timing information if enabled
7.  **Output formatting:** Based on the requested output format:
    - Human-readable: Formats with colors, metadata, and user-friendly text
    - JSON: Creates structured envelopes with consistent schema
8.  **Display to user:** The formatted response is written to stdout/stderr as appropriate

## Key Design Principles

- **Provider Abstraction:** All AI providers implement a common interface, making it easy to add new providers or switch between them
- **Configuration Flexibility:** Multiple configuration sources with clear precedence rules allow users to configure the CLI in the way that works best for their workflow
- **Consistent Output:** Both human-readable and JSON output formats provide consistent, predictable results across all providers
- **Error Handling:** Normalized error responses with helpful hints make troubleshooting easier
- **Extensibility:** The modular architecture makes it straightforward to add new providers, commands, or output formats
- **Developer Experience:** TypeScript throughout, comprehensive testing, and clear interfaces make the codebase maintainable
