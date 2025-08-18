# Welcome to Entole CLI documentation

This documentation provides a comprehensive guide to installing, using, and developing Entole CLI. This tool lets you interact with multiple AI providers through a unified command-line interface.

## Overview

Entole CLI brings the capabilities of multiple AI providers (OpenAI, Anthropic, Ollama, OpenRouter) to your terminal through a simple, unified interface. Entole CLI is a single-package application that provides chat and embedding functionality across multiple AI providers with consistent configuration and output formats.

## Navigating the documentation

This documentation is organized into the following sections:

- **[Execution and Deployment](./deployment.md):** Information for running Gemini CLI.
- **[Architecture Overview](./architecture.md):** Understand the high-level design of Gemini CLI, including its components and how they interact.
- **CLI Usage:** Documentation for `packages/cli`.
  - **[CLI Introduction](./cli/index.md):** Overview of the command-line interface.
  - **[Commands](./cli/commands.md):** Description of available CLI commands.
  - **[Configuration](./cli/configuration.md):** Information on configuring the CLI.
  - **[Checkpointing](./checkpointing.md):** Documentation for the checkpointing feature.
  - **[Extensions](./extension.md):** How to extend the CLI with new functionality.
  - **[IDE Integration](./ide-integration.md):** Connect the CLI to your editor.
  - **[Telemetry](./telemetry.md):** Overview of telemetry in the CLI.
- **Core Details:** Documentation for `packages/core`.
  - **[Core Introduction](./core/index.md):** Overview of the core component.
  - **[Tools API](./core/tools-api.md):** Information on how the core manages and exposes tools.
- **Tools:**
  - **[Tools Overview](./tools/index.md):** Overview of the available tools.
  - **[File System Tools](./tools/file-system.md):** Documentation for the `read_file` and `write_file` tools.
  - **[Multi-File Read Tool](./tools/multi-file.md):** Documentation for the `read_many_files` tool.
  - **[Shell Tool](./tools/shell.md):** Documentation for the `run_shell_command` tool.
  - **[Web Fetch Tool](./tools/web-fetch.md):** Documentation for the `web_fetch` tool.
  - **[Web Search Tool](./tools/web-search.md):** Documentation for the `google_web_search` tool.
  - **[Memory Tool](./tools/memory.md):** Documentation for the `save_memory` tool.
- **[Contributing & Development Guide](../CONTRIBUTING.md):** Information for contributors and developers, including setup, building, testing, and coding conventions.
- **[NPM Workspaces and Publishing](./npm.md):** Details on how the project's packages are managed and published.
- **[Troubleshooting Guide](./troubleshooting.md):** Find solutions to common problems and FAQs.
- **[Terms of Service and Privacy Notice](./tos-privacy.md):** Information on the terms of service and privacy notices applicable to your use of Gemini CLI.

We hope this documentation helps you make the most of the Gemini CLI!
