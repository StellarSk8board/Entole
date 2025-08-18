# Troubleshooting guide

This guide provides solutions to common issues and debugging tips for Entole CLI, including topics on:

- API key and authentication errors
- Configuration issues
- Provider connectivity problems
- Frequently asked questions (FAQs)
- Debugging tips
- Existing GitHub Issues similar to yours or creating new Issues

## API key and authentication errors

- **Error: `Invalid API key` or `401 Unauthorized`**
  - **Cause:** Your API key is missing, incorrect, or expired
  - **Solution:**
    - Check that your API key is correctly set in environment variables or config file
    - Verify the API key format matches the provider's requirements
    - For OpenAI: Keys should start with `sk-`
    - For Anthropic: Keys should start with `sk-ant-`
    - For OpenRouter: Keys should be valid OpenRouter API keys

- **Error: `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` or `unable to get local issuer certificate`**
  - **Cause:** You may be on a corporate network with a firewall that intercepts and inspects SSL/TLS traffic. This often requires a custom root CA certificate to be trusted by Node.js.
  - **Solution:** Set the `NODE_EXTRA_CA_CERTS` environment variable to the absolute path of your corporate root CA certificate file.
    - Example: `export NODE_EXTRA_CA_CERTS=/path/to/your/corporate-ca.crt`

- **Error: `Rate limit exceeded`**
  - **Cause:** You've exceeded the API rate limits for your provider
  - **Solution:** Wait for the rate limit to reset, or upgrade your API plan if available

## Frequently asked questions (FAQs)

- **Q: How do I update Entole CLI to the latest version?**
  - A: If you installed it globally via `npm`, update it using the command `npm install -g entole@latest`. If you compiled it from source, pull the latest changes from the repository, and then rebuild using the command `npm run build`.

- **Q: Where are the Entole CLI configuration files stored?**
  - A: Entole CLI looks for configuration files in the following locations:
    1. `entole.config.json` or `entole.config.yaml` in the current directory
    2. `entole.config.json` or `entole.config.yaml` in your home directory
    3. Environment variables (highest priority)

- **Q: Which AI providers does Entole support?**
  - A: Entole supports OpenAI, Anthropic, Ollama (local), OpenRouter, and has stubs for Mistral and Cohere. Each provider supports different capabilities (chat, embeddings, or both).

- **Q: How do I switch between different AI providers?**
  - A: You can specify a provider using the `--provider` flag (e.g., `entole chat --provider anthropic "Hello"`), set it in your configuration file, or use environment variables like `ENTOLE_DEFAULT_CHAT_PROVIDER`.

- **Q: Why am I getting connection errors with Ollama?**
  - A: Make sure Ollama is running locally with `ollama serve`. By default, Entole expects Ollama at `http://localhost:11434`. You can change this with the `OLLAMA_HOST` environment variable.

## Common error messages and solutions

- **Error: Command not found (when attempting to run Entole CLI with `entole`).**
  - **Cause:** Entole CLI is not correctly installed or it is not in your system's `PATH`.
  - **Solution:**
    The solution depends on how you installed Entole CLI:
    - If you installed `entole` globally, check that your `npm` global binary directory is in your `PATH`. You can update Entole CLI using the command `npm install -g entole@latest`.
    - If you are running `entole` from source, ensure you are using the correct command to invoke it (e.g., `node dist/index.js ...`). To update Entole CLI, pull the latest changes from the repository, and then rebuild using the command `npm run build`.

- **Error: `MODULE_NOT_FOUND` or import errors.**
  - **Cause:** Dependencies are not installed correctly, or the project hasn't been built.
  - **Solution:**
    1.  Run `npm install` to ensure all dependencies are present.
    2.  Run `npm run build` to compile the project.
    3.  Verify that the build completed successfully with `node dist/index.js --help`.

- **Error: `Configuration validation failed`**
  - **Cause:** Your configuration file has invalid syntax or structure.
  - **Solution:**
    1. Run `entole doctor` to see specific validation errors
    2. Check your `entole.config.json` or `entole.config.yaml` file for syntax errors
    3. Refer to the configuration schema in the README for valid options

- **Error: `No provider available for capability`**
  - **Cause:** You're trying to use a capability (chat or embeddings) that none of your configured providers support.
  - **Solution:**
    1. Check which providers are available with `entole providers list`
    2. Ensure you have API keys configured for providers that support the capability you need
    3. For embeddings, make sure you're using a provider that supports embeddings (OpenAI, Ollama, OpenRouter)

- **Error: `Connection failed` or `ECONNREFUSED`**
  - **Cause:** Network connectivity issues or the provider's API is unavailable.
  - **Solution:**
    1. Check your internet connection
    2. For Ollama: Ensure Ollama is running with `ollama serve`
    3. Try a different provider to isolate the issue
    4. Check the provider's status page for known outages

## Debugging Tips

- **Configuration debugging:**
  - Use `entole doctor` to validate your configuration and check provider connectivity
  - Use `entole providers list` to see which providers are available and their capabilities
  - Check environment variables with `env | grep -E "(OPENAI|ANTHROPIC|OLLAMA|OPENROUTER|ENTOLE)"`

- **API debugging:**
  - Use the `--json` flag to get structured output that's easier to parse
  - Check API key validity by testing with a simple request
  - For rate limiting issues, try a different provider or wait before retrying

- **Provider-specific debugging:**
  - **OpenAI**: Verify your API key at https://platform.openai.com/api-keys
  - **Anthropic**: Check your API key at https://console.anthropic.com/
  - **Ollama**: Ensure Ollama is running with `ollama list` to see available models
  - **OpenRouter**: Verify your API key at https://openrouter.ai/keys

- **Development debugging:**
  - Run `npm run typecheck` to catch TypeScript errors
  - Run `npm run lint` to check code style
  - Run `npm test` to ensure all tests pass
  - Use `npm run build && node dist/index.js` to test the built version

## Existing GitHub Issues similar to yours or creating new Issues

If you encounter an issue that was not covered here in this _Troubleshooting guide_, consider searching the Entole CLI [Issue tracker on GitHub](https://github.com/StellarSk8board/Entole/issues). If you can't find an issue similar to yours, consider creating a new GitHub Issue with a detailed description. Pull requests are also welcome!
