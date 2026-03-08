#!/bin/bash

# Import OpenChief Multi-Provider tasks to Linear
# Requires: linear CLI authenticated (run 'linear login' first)

set -e

echo "🎯 Importing OpenChief Multi-Provider tasks to Linear"
echo "=================================================="
echo ""

# Check if linear CLI is authenticated
if ! linear whoami &> /dev/null; then
    echo "❌ Linear CLI not authenticated"
    echo "Run 'linear login' first"
    exit 1
fi

echo "✅ Linear authenticated"
echo ""

# Get team ID (will prompt if multiple teams)
TEAM_ID=$(linear team -l | head -1 | awk '{print $1}')
echo "📍 Team ID: $TEAM_ID"
echo ""

# Create Epic
echo "Creating Epic: Multi-Provider LLM Integration..."
EPIC_ID=$(linear issue create \
    --title "Multi-Provider LLM Integration" \
    --description "Extend OpenChief to support multiple LLM providers (Anthropic, GLM, Gemini CLI, Codex CLI) with OAuth and subscription-based auth" \
    --priority high \
    --team "$TEAM_ID" \
    --label "epic" \
    --label "infrastructure" \
    --no-interaction \
    --json | jq -r '.id')

echo "✅ Epic created: $EPIC_ID"
echo ""

# Create Main Task
echo "Creating Main Task: Multi-Provider Architecture..."
MAIN_TASK_ID=$(linear issue create \
    --title "Multi-Provider LLM Architecture" \
    --description "Build provider abstraction layer and implement 4 LLM providers" \
    --priority high \
    --team "$TEAM_ID" \
    --parent "$EPIC_ID" \
    --state "Done" \
    --label "completed" \
    --estimate 4 \
    --no-interaction \
    --json | jq -r '.id')

echo "✅ Main task created: $MAIN_TASK_ID"
echo ""

# Create Subtasks
echo "Creating subtasks..."

SUBTASKS=(
    "Provider Abstraction Layer|Done|1|base.ts with LLMProvider interface"
    "Anthropic Provider OAuth-Ready|Done|1|API key + OAuth prepared for future"
    "Z.ai GLM Provider|Done|0.75|OpenAI-compatible API, \$10/mo"
    "Gemini CLI Provider|Done|0.75|CLI wrapper for local dev"
    "OpenAI Codex CLI Provider|Done|0.75|CLI wrapper for local dev"
    "Unified LLM Client|Done|0.5|Routing layer with backwards compat"
    "Configuration Type Updates|Done|0.25|Updated OpenChiefConfig types"
)

for task in "${SUBTASKS[@]}"; do
    IFS='|' read -r title state estimate description <<< "$task"
    linear issue create \
        --title "$title" \
        --description "$description" \
        --priority high \
        --team "$TEAM_ID" \
        --parent "$MAIN_TASK_ID" \
        --state "$state" \
        --estimate "$estimate" \
        --no-interaction &> /dev/null
    echo "  ✓ $title"
done

echo ""
echo "Creating sibling tasks..."

# Documentation Task
DOC_TASK_ID=$(linear issue create \
    --title "Documentation & Setup Tooling" \
    --description "Complete setup guide, interactive script, and technical docs" \
    --priority high \
    --team "$TEAM_ID" \
    --parent "$EPIC_ID" \
    --state "Done" \
    --estimate 2 \
    --no-interaction \
    --json | jq -r '.id')

echo "  ✓ Documentation & Setup Tooling"

# Testing Task
TEST_TASK_ID=$(linear issue create \
    --title "Testing & Validation" \
    --description "Test all 4 providers in local dev and production" \
    --priority high \
    --team "$TEAM_ID" \
    --parent "$EPIC_ID" \
    --state "Todo" \
    --estimate 2 \
    --label "ready-to-start" \
    --no-interaction \
    --json | jq -r '.id')

echo "  ✓ Testing & Validation (Ready to start)"

# Deployment Task
DEPLOY_TASK_ID=$(linear issue create \
    --title "Cloudflare Workers Deployment" \
    --description "Deploy to production with GLM or Anthropic" \
    --priority medium \
    --team "$TEAM_ID" \
    --parent "$EPIC_ID" \
    --state "Backlog" \
    --estimate 1 \
    --no-interaction \
    --json | jq -r '.id')

echo "  ✓ Cloudflare Workers Deployment"

# Future Enhancements Task
FUTURE_TASK_ID=$(linear issue create \
    --title "Future Enhancements" \
    --description "Anthropic OAuth, provider plugins, health monitoring, failover, per-agent selection" \
    --priority low \
    --team "$TEAM_ID" \
    --parent "$EPIC_ID" \
    --state "Backlog" \
    --label "enhancement" \
    --no-interaction \
    --json | jq -r '.id')

echo "  ✓ Future Enhancements"

echo ""
echo "🎉 Import complete!"
echo ""
echo "Epic ID: $EPIC_ID"
echo "Next task: $TEST_TASK_ID (Testing & Validation)"
echo ""
echo "View in Linear:"
echo "https://linear.app/team/issue/$EPIC_ID"
