#!/bin/bash

# create-env.sh - Environment Variable Setup Script for Release Digest
# This script validates required secrets/variables and sets up environment variables
# for the release digest workflow.

set -e  # Exit on any error

echo "🔧 Setting up environment variables for Release Digest..."

# Function to log messages with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Validate required secrets and variables
log "Validating required secrets and variables..."

if [ -z "$TOKEN_GITHUB" ]; then
    log "❌ Error: TOKEN_GITHUB secret must be set (use a PAT with org read access)"
    exit 1
fi

if [ -z "$SLACK_WEBHOOK_URL" ]; then
    log "❌ Error: SLACK_WEBHOOK_URL secret is not set"
    exit 1
fi

# AI Provider configuration (optional)
if [ -n "$ANTHROPIC_API_KEY" ]; then
    log "✅ ANTHROPIC_API_KEY configured for AI summarization (primary)"
    ai_configured=true
else
    log "⚠️  ANTHROPIC_API_KEY not provided"
    ai_configured=false
fi

if [ -n "$OPENROUTER_API_KEY" ]; then
    log "✅ OPENROUTER_API_KEY configured for AI summarization (fallback)"
    ai_configured=true
else
    log "⚠️  OPENROUTER_API_KEY not provided"
fi

# AI Model configuration (optional)
if [ -n "$ANTHROPIC_MODEL" ]; then
    log "✅ ANTHROPIC_MODEL configured: $ANTHROPIC_MODEL"
else
    log "ℹ️  ANTHROPIC_MODEL not provided - using default: claude-3-5-sonnet-20241022"
fi

if [ "$ai_configured" = true ]; then
    log "✅ AI summarization enabled"
else
    log "⚠️  Warning: No AI API keys provided - AI summarization will be disabled"
fi

# Validate Snowflake configuration (JSON only)
log "Validating Snowflake configuration..."

if [ -n "$SNOWFLAKE_CONFIG" ]; then
    log "✅ SNOWFLAKE_CONFIG (JSON) is provided"
    log "✅ Snowflake integration enabled"
else
    log "⚠️  Warning: SNOWFLAKE_CONFIG secret not found - will fall back to GitHub API"
    log "⚠️  Note: Only JSON configuration is supported. Set SNOWFLAKE_CONFIG secret with JSON format."
fi

# Persist validated secrets/vars for subsequent steps
echo "SLACK_WEBHOOK_URL=$SLACK_WEBHOOK_URL" >> $GITHUB_ENV
echo "ORG_NAME=$ORG_NAME" >> $GITHUB_ENV
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" >> $GITHUB_ENV
fi
if [ -n "$OPENROUTER_API_KEY" ]; then
    echo "OPENROUTER_API_KEY=$OPENROUTER_API_KEY" >> $GITHUB_ENV
fi
if [ -n "$ANTHROPIC_MODEL" ]; then
    echo "ANTHROPIC_MODEL=$ANTHROPIC_MODEL" >> $GITHUB_ENV
fi

# Persist Snowflake configuration (JSON only)
if [ -n "$SNOWFLAKE_CONFIG" ]; then
    echo "SNOWFLAKE_CONFIG=$SNOWFLAKE_CONFIG" >> $GITHUB_ENV
fi

# AI model selection handled by application logic (Anthropic → OpenRouter fallback)
log "ℹ️  AI model selection: Anthropic (primary) → OpenRouter (fallback)"

if [ -z "$ORG_NAME" ]; then
    log "❌ Error: ORG_NAME variable is not set"
    exit 1
fi

# Use only TOKEN_GITHUB (PAT)
echo "GITHUB_TOKEN_ACTUAL=$TOKEN_GITHUB" >> $GITHUB_ENV
echo "TOKEN_GITHUB=$TOKEN_GITHUB" >> $GITHUB_ENV
log "✅ Using TOKEN_GITHUB (PAT) for authentication"

# Handle scheduled vs manual runs
if [ "$GITHUB_EVENT_NAME" = "schedule" ]; then
    # For scheduled runs, use default values: 7 days back
    log "📅 Scheduled run detected - using default values"
    echo "HOURS_BACK=" >> $GITHUB_ENV
    echo "TARGET_DATE=" >> $GITHUB_ENV
    echo "DAYS_BACK=7" >> $GITHUB_ENV
    echo "REPOSITORIES=" >> $GITHUB_ENV
    echo "INCLUDE_DESCRIPTIONS=true" >> $GITHUB_ENV
    echo "CLI_ARGS=--days 7 --include-descriptions" >> $GITHUB_ENV
    log "✅ Configured for 7-day lookback with detailed descriptions"
else
    # For manual runs, validate and set timeframe variables
    log "👤 Manual run detected - processing input parameters"

    if [ "$INPUT_TIMEFRAME_TYPE" = "hours" ]; then
        if ! [[ "$INPUT_VALUE" =~ ^[0-9]+$ ]]; then
            log "❌ For 'hours' timeframe, VALUE must be a number (hours back)."
            exit 1
        fi
        if [ "$INPUT_VALUE" -gt 168 ]; then
            log "❌ Hours cannot exceed 168 (7 days)."
            exit 1
        fi
        echo "HOURS_BACK=$INPUT_VALUE" >> $GITHUB_ENV
        echo "TARGET_DATE=" >> $GITHUB_ENV
        echo "DAYS_BACK=" >> $GITHUB_ENV
        log "✅ Configured for $INPUT_VALUE hours lookback"

    elif [ "$INPUT_TIMEFRAME_TYPE" = "days" ]; then
        if ! [[ "$INPUT_VALUE" =~ ^[0-9]+$ ]]; then
            log "❌ For 'days' timeframe, VALUE must be a number (days back)."
            exit 1
        fi
        if [ "$INPUT_VALUE" -gt 7 ]; then
            log "❌ Days cannot exceed 7."
            exit 1
        fi
        echo "HOURS_BACK=" >> $GITHUB_ENV
        echo "TARGET_DATE=" >> $GITHUB_ENV
        echo "DAYS_BACK=$INPUT_VALUE" >> $GITHUB_ENV
        log "✅ Configured for $INPUT_VALUE days lookback"

    elif [ "$INPUT_TIMEFRAME_TYPE" = "date" ]; then
        if [ -z "$INPUT_VALUE" ]; then
            log "❌ For 'date' timeframe, VALUE must be a date (YYYY-MM-DD)."
            exit 1
        fi
        # Validate date format
        if ! [[ "$INPUT_VALUE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
            log "❌ Date must be in YYYY-MM-DD format."
            exit 1
        fi
        echo "HOURS_BACK=" >> $GITHUB_ENV
        echo "TARGET_DATE=$INPUT_VALUE" >> $GITHUB_ENV
        echo "DAYS_BACK=" >> $GITHUB_ENV
        log "✅ Configured for target date: $INPUT_VALUE"
    fi

    # Set optional variables for manual runs
    if [ -n "$INPUT_REPOSITORIES" ]; then
        echo "REPOSITORIES=$INPUT_REPOSITORIES" >> $GITHUB_ENV
        log "✅ Repository filter configured: $INPUT_REPOSITORIES"
    else
        echo "REPOSITORIES=" >> $GITHUB_ENV
        log "✅ No repository filter - processing all repositories"
    fi

    echo "INCLUDE_DESCRIPTIONS=$INPUT_INCLUDE_DESCRIPTIONS" >> $GITHUB_ENV
    log "✅ Include descriptions: $INPUT_INCLUDE_DESCRIPTIONS"

    # Build CLI args for manual runs from workflow inputs
    CLI_ARGS=""
    if [ "$INPUT_TIMEFRAME_TYPE" = "hours" ] && [ -n "$INPUT_VALUE" ]; then
        CLI_ARGS="$CLI_ARGS --hours $INPUT_VALUE"
    elif [ "$INPUT_TIMEFRAME_TYPE" = "days" ] && [ -n "$INPUT_VALUE" ]; then
        CLI_ARGS="$CLI_ARGS --days $INPUT_VALUE"
    elif [ "$INPUT_TIMEFRAME_TYPE" = "date" ] && [ -n "$INPUT_VALUE" ]; then
        CLI_ARGS="$CLI_ARGS --date $INPUT_VALUE"
    fi
    if [ -n "$INPUT_REPOSITORIES" ]; then
        CLI_ARGS="$CLI_ARGS --repos $INPUT_REPOSITORIES"
    fi
    if [ "$INPUT_INCLUDE_DESCRIPTIONS" = "true" ]; then
        CLI_ARGS="$CLI_ARGS --include-descriptions"
    fi
    echo "CLI_ARGS=$CLI_ARGS" >> $GITHUB_ENV
fi

# Default application environment
echo "NODE_ENV=${NODE_ENV:-production}" >> $GITHUB_ENV
echo "LOG_LEVEL=${LOG_LEVEL:-info}" >> $GITHUB_ENV

log "🎉 Environment variable setup completed successfully!"
