#!/bin/bash

# Copyright 2024 Metisse
# SPDX-License-Identifier: Apache-2.0

# Installation verification script for Entole CLI
# Tests that the installed package works correctly

set -e

echo "🔍 Verifying Entole CLI Installation"
echo "===================================="

# Check if entole command is available
if ! command -v entole >/dev/null 2>&1; then
    echo "❌ entole command not found in PATH"
    echo "   Make sure you've installed the package globally with 'npm install -g .'"
    exit 1
fi

echo "✅ entole command found in PATH"

# Test version command
echo "📋 Testing version command..."
VERSION=$(entole --version)
echo "✅ Version: $VERSION"

# Test help command
echo "📋 Testing help command..."
if entole --help >/dev/null 2>&1; then
    echo "✅ Help command works"
else
    echo "❌ Help command failed"
    exit 1
fi

# Test providers list
echo "📋 Testing providers list..."
if entole providers list >/dev/null 2>&1; then
    echo "✅ Providers list command works"
else
    echo "❌ Providers list command failed"
    exit 1
fi

# Test JSON output
echo "📋 Testing JSON output..."
if entole providers list --json | jq . >/dev/null 2>&1; then
    echo "✅ JSON output is valid"
elif entole providers list --json >/dev/null 2>&1; then
    echo "⚠️  JSON output works but jq not available for validation"
else
    echo "❌ JSON output failed"
    exit 1
fi

# Test doctor command
echo "📋 Testing doctor command..."
entole doctor >/dev/null 2>&1 || echo "⚠️  Doctor command shows configuration issues (expected without API keys)"

echo ""
echo "🎉 Installation verification complete!"
echo "✅ Entole CLI is properly installed and functional"
echo ""
echo "Next steps:"
echo "  1. Set up API keys for your preferred providers"
echo "  2. Run 'entole doctor' to check configuration"
echo "  3. Try 'entole chat \"Hello world\"' to test chat functionality"