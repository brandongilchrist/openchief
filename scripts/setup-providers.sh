#!/bin/bash

# Multi-Provider Setup Script for OpenChief
# Helps configure LLM providers interactively

set -e

echo "🤖 OpenChief Multi-Provider Setup"
echo "=================================="
echo ""

# Detect environment
if [ -f "wrangler.toml" ] || [ -f "wrangler.jsonc" ]; then
    ENV="cloudflare"
    echo "📍 Environment: Cloudflare Workers"
else
    ENV="local"
    echo "📍 Environment: Local development"
fi

echo ""
echo "Available providers:"
echo "  1) Anthropic Claude (API key) - Works everywhere"
echo "  2) Z.ai GLM (API key) - Works everywhere"
echo "  3) Google Gemini CLI - Local dev only"
echo "  4) OpenAI Codex CLI - Local dev only"
echo ""

read -p "Select provider (1-4): " CHOICE

case $CHOICE in
    1)
        PROVIDER="anthropic"
        echo ""
        echo "🔧 Configuring Anthropic Claude..."
        echo ""
        read -p "Enter your Anthropic API key: " API_KEY
        
        if [ "$ENV" = "cloudflare" ]; then
            echo "$API_KEY" | wrangler secret put ANTHROPIC_API_KEY
            echo "✅ API key saved to Cloudflare Workers secret"
        else
            # Save to .env for local dev
            echo "ANTHROPIC_API_KEY=$API_KEY" >> .env
            echo "✅ API key saved to .env"
        fi
        ;;
    
    2)
        PROVIDER="glm"
        echo ""
        echo "🔧 Configuring Z.ai GLM..."
        echo ""
        read -p "Enter your Z.ai API key: " API_KEY
        
        if [ "$ENV" = "cloudflare" ]; then
            echo "glm" | wrangler secret put LLM_PROVIDER_TYPE
            echo "{\"apiKey\":\"$API_KEY\",\"model\":\"glm-5\"}" | wrangler secret put LLM_PROVIDER_CONFIG
            echo "✅ GLM configured in Cloudflare Workers"
        else
            echo "LLM_PROVIDER_TYPE=glm" >> .env
            echo "LLM_PROVIDER_CONFIG={\"apiKey\":\"$API_KEY\",\"model\":\"glm-5\"}" >> .env
            echo "✅ GLM configured in .env"
        fi
        ;;
    
    3)
        PROVIDER="gemini"
        if [ "$ENV" = "cloudflare" ]; then
            echo "⚠️  Gemini CLI only works in local development!"
            echo "For Cloudflare Workers, use Anthropic or GLM instead."
            exit 1
        fi
        
        echo ""
        echo "🔧 Configuring Google Gemini CLI..."
        echo ""
        
        # Check if gemini is installed
        if ! command -v gemini &> /dev/null; then
            echo "❌ Gemini CLI not found. Installing..."
            npm install -g google-gemini-cli
        fi
        
        echo "✅ Gemini CLI found"
        echo ""
        echo "Please authenticate with your Google subscription:"
        gemini auth login
        
        # Update config file
        echo ""
        echo "⚙️  Updating openchief.config.ts..."
        
        # This is a simplified approach - in practice you'd want to parse and update the TS file properly
        cat >> openchief.config.ts << 'EOF'

// Multi-provider configuration (added by setup script)
runtime: {
  llmProvider: {
    type: "gemini",
    config: {
      cliPath: "gemini"
    }
  }
}
EOF
        
        echo "✅ Gemini configured for local development"
        ;;
    
    4)
        PROVIDER="openai-codex"
        if [ "$ENV" = "cloudflare" ]; then
            echo "⚠️  OpenAI Codex CLI only works in local development!"
            echo "For Cloudflare Workers, use Anthropic or GLM instead."
            exit 1
        fi
        
        echo ""
        echo "🔧 Configuring OpenAI Codex CLI..."
        echo ""
        
        # Check if codex is installed
        if ! command -v codex &> /dev/null; then
            echo "❌ Codex CLI not found. Installing..."
            npm install -g openai-codex
        fi
        
        echo "✅ Codex CLI found"
        echo ""
        echo "Please authenticate with your OpenAI subscription:"
        codex auth login
        
        echo ""
        echo "⚙️  Updating openchief.config.ts..."
        
        cat >> openchief.config.ts << 'EOF'

// Multi-provider configuration (added by setup script)
runtime: {
  llmProvider: {
    type: "openai-codex",
    config: {
      cliPath: "codex"
    }
  }
}
EOF
        
        echo "✅ Codex configured for local development"
        ;;
    
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎉 Provider configured successfully!"
echo ""
echo "Next steps:"
echo "  1. Test your configuration:"

if [ "$ENV" = "cloudflare" ]; then
    echo "     pnpm run deploy"
else
    echo "     pnpm dev"
fi

echo "  2. Trigger a test report from the dashboard"
echo "  3. Check logs to verify provider is working"
echo ""
echo "📚 Documentation: docs/MULTI_PROVIDER_SETUP.md"
