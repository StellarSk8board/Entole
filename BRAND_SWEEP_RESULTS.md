# Brand Sweep Results

This document summarizes the brand violations found by the initial brand sweep and categorizes them for systematic resolution.

## Summary

- **Total violations found**: 1,000+ instances
- **Files scanned**: 200+ files
- **Exit code**: 1 (violations found)

## Categories of Violations

### 1. Package Metadata and Configuration
- `package.json`: Name, description, repository URLs, bin entries
- `packages/vscode-ide-companion/package.json`: Extension metadata
- Various config files referencing Google/Gemini

### 2. Documentation and README Files
- Main `README.md`: Product descriptions, usage examples
- VSCode extension README: Feature descriptions, installation instructions
- Various documentation files in `docs/` directory

### 3. Source Code References
- Import statements: `@google/gemini-cli-core`
- Command names: `gemini-cli.runGeminiCLI`
- File paths: `.gemini/` directories
- Variable names: `geminiCmd`, `GEMINI_DIR`
- Function names and identifiers

### 4. CLI Commands and Scripts
- Binary name: `gemini` → should be `entole`
- Command references in shell scripts
- Alias creation scripts
- Terminal integration commands

### 5. URLs and External References
- GitHub repository URLs: `github.com/google-gemini/gemini-cli`
- API endpoints: `googleapis.com`, `ai.google.dev`
- Documentation links
- Terms of service links

### 6. VSCode Extension Integration
- Extension commands: `gemini.diff.accept`, `gemini-cli.runGeminiCLI`
- Context variables: `gemini.diff.isVisible`
- Output channel names: "Gemini CLI IDE Companion"
- File schemes: `gemini-diff`

## Allowed Violations (Intentionally Preserved)

The following violations are intentionally allowed for legal compliance:

1. **LICENSE file**: Upstream Apache 2.0 license must remain unchanged
2. **NOTICE file**: Required attribution to "Google LLC" for upstream work
3. **Copyright headers**: Existing "Copyright 2025 Google LLC" headers preserved
4. **Attribution comments**: References in comments marked as "upstream"

## Priority Order for Resolution

### High Priority (Breaks functionality)
1. Package.json metadata (name, bin, repository)
2. Import statements and module references
3. CLI command names and entry points
4. Configuration file paths (`.gemini` → `.entole` or remove)

### Medium Priority (User-facing)
1. Documentation and README files
2. Help text and error messages
3. VSCode extension metadata
4. Command descriptions

### Low Priority (Internal references)
1. Variable names and internal identifiers
2. Comment references (non-attribution)
3. Development scripts and utilities
4. Test file references

## Next Steps

1. **Phase 1**: Update package metadata and core functionality
2. **Phase 2**: Rebrand user-facing documentation and messages
3. **Phase 3**: Clean up internal references and variable names
4. **Phase 4**: Update development tooling and scripts

## Verification

After each phase, run `npm run brand:sweep` to verify progress and ensure no new violations are introduced.

The brand sweep script will continue to exit with code 1 until all violations are resolved, making it suitable for CI/CD integration to prevent regressions.