# GitHub Release Digest

> Automated GitHub release summary service that fetches and posts daily/recent release summaries to Slack with AI-powered executive summaries

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-185%20passing-brightgreen.svg)](#testing)
[![AI](https://img.shields.io/badge/AI-Anthropic%20%2B%20OpenRouter-purple.svg)](#ai-integration)

## 🎯 Overview

GitHub Release Digest is a TypeScript service that monitors GitHub repositories within an organization, collects release information from Snowflake (primary) or GitHub API (fallback), generates AI-powered executive summaries using dual AI providers, and automatically posts formatted summaries to Slack channels. It supports both scheduled daily summaries and on-demand recent release queries with advanced filtering capabilities.

## 🏗️ Business Logic Workflow

### High-Level Process Flow

```mermaid
graph TD
    A[Start Service] --> B[Parse CLI Arguments]
    B --> C[Load Configuration]
    C --> D[Validate Environment]
    D --> E{Data Source?}
    E -->|Snowflake Available| F[Get Snowflake Data]
    E -->|Snowflake Failed/Missing| G[Get GitHub API Data]
    F --> H[Format Messages]
    G --> H
    H --> I{AI Available?}
    I -->|Anthropic| J[Generate AI Summaries - Anthropic]
    I -->|OpenRouter Fallback| K[Generate AI Summaries - OpenRouter]
    I -->|None| L[Use Original Text]
    J --> M[Post to Slack]
    K --> M
    L --> M
    M --> N[Complete]
    
    style A fill:#e1f5fe,color:#000
    style N fill:#c8e6c9,color:#000
    style F fill:#e8f5e8,color:#000
    style G fill:#fff3e0,color:#000
    style J fill:#f3e5f5,color:#000
    style K fill:#fce4ec,color:#000
```

**Enhanced Flow:**

- **Dual Data Sources**: Snowflake (primary) with GitHub API fallback for reliability
- **Smart Data Fetching**: Efficient SQL queries (Snowflake) or GraphQL queries (GitHub) with repository filtering
- **Dual AI Providers**: Anthropic (primary) with OpenRouter fallback for reliable summarization
- **Configurable Models**: Environment-based AI model selection for both providers
- **Separate Message Formatting**: Individual messages per repository for better Slack rendering
- **Summary Tables**: Tabular overview for multiple repositories
- **Clean Sending**: Multiple `postToSlack()` calls for separate messages

### Detailed Workflow Components

#### 1. 🔧 Configuration & Setup

- **Environment Validation**: Validates required environment variables (`TOKEN_GITHUB`, `SLACK_WEBHOOK_URL`, `ORG_NAME`)
- **Optional Integrations**: Validates optional Snowflake and AI provider configurations
- **CLI Processing**: Parses command-line arguments (help, timeframe, repository filtering)
- **Timeframe Configuration**: Loads timeframe from environment variables (`HOURS_BACK`, `DAYS_BACK`, `TARGET_DATE`, `START_DATE`, `END_DATE`)
- **Repository Filtering**: Supports single repository (`--repo`) or multiple repositories (`--repos`)
- **AI Provider Setup**: Configures Anthropic (primary) and OpenRouter (fallback) with model selection
- **Data Source Selection**: Determines Snowflake vs GitHub API data source priority
- **Logger Initialization**: Sets up contextual logging with timestamps

#### 2. 📥 Data Fetching Pipeline

**Dual Data Source Architecture**

```mermaid
sequenceDiagram
    participant Main as Main Service
    participant Release as Release Class
    participant SF as Snowflake Client
    participant Repo as Repository Class
    participant GQL as GitHub GraphQL Client
    participant API as GitHub API
    
    Main->>Release: getReleases(config)
    Release->>Release: Check Snowflake availability
    
    alt Snowflake Available
        Release->>SF: fetchReleasesFromSnowflake(config)
        SF->>SF: Build SQL query with filters
        SF->>API: Execute SQL query
        API-->>SF: Raw SQL results
        SF->>SF: Map to ReleaseInfo[]
        SF-->>Release: Filtered ReleaseInfo[]
    else Snowflake Failed/Missing
        Note over Release: Fallback to GitHub API
        alt Specific Repositories Requested
            Release->>Repo: fetchSpecificRepositories(orgName, repositories)
            Repo->>GQL: fetchSingleRepository(orgName, repoName)
            GQL->>API: Single Repository GraphQL Query
            API-->>GQL: Repository data + releases
            GQL-->>Repo: Structured response
            Repo-->>Release: Filtered repositories
        else All Repositories
            Release->>Repo: fetchAllRepositories(params)
            Repo->>GQL: fetchRepositoriesPage(variables)
            GQL->>API: GraphQL Query (with pagination)
            API-->>GQL: Repository data + releases
            GQL-->>Repo: Structured response
            Repo-->>Release: All repositories
        end
        Release->>Release: Process & filter by date
    end
    Release-->>Main: Filtered ReleaseInfo[]
```

**Key Features:**

- **Dual Data Sources**: Snowflake (preferred) with GitHub API fallback for reliability
- **Efficient SQL Queries**: Direct database queries with timeframe and repository filtering (Snowflake)
- **Efficient GraphQL Queries**: Direct single-repository queries when specific repos requested (GitHub API)
- **Smart Fallback**: Automatic GitHub API fallback when Snowflake unavailable or fails
- **Pagination**: Handles large organizations with 100+ repositories (GitHub API)
- **Early Stopping**: Stops fetching when repositories updates are older than cutoff date (GitHub API)
- **Retry Logic**: Exponential backoff for API failures (3 retries max)
- **Rate Limiting**: 100ms delay between API pages (GitHub API)
- **Dynamic SQL Generation**: Builds SQL queries based on timeframe and repository filters (Snowflake)

#### 3. 🤖 AI Integration

**Dual AI Provider Strategy**

```mermaid
graph LR
    A[Release Description] --> B[Clean Description]
    B --> C[Load AI Instructions]
    C --> D[Generate Prompt]
    D --> E{Try Anthropic}
    E -->|Success| F[Anthropic Claude]
    E -->|Fail/Unavailable| G[OpenRouter Fallback]
    F --> H[Executive Summary]
    G --> I[Executive Summary]
    F -->|Error| G
    G -->|Both Fail| J[Original Cleaned Text]
    H --> K[Format for Slack]
    I --> K
    J --> K
    
    style F fill:#f3e5f5,color:#000
    style G fill:#fce4ec,color:#000
    style H fill:#e8f5e8,color:#000
    style I fill:#e8f5e8,color:#000
```

**AI Features:**

- **Dual Provider Strategy**: Anthropic (primary) with OpenRouter (fallback) for reliability
- **Configurable Models**: Environment-based model selection (`ANTHROPIC_MODEL`, `AI_MODEL`)
- **External Instructions**: AI prompts stored in `src/AI/instructions.md`
- **Business Focus**: Executive summaries for non-technical stakeholders
- **Content Cleaning**: Removes markdown, URLs, technical jargon
- **Multi-level Fallback**: Anthropic → OpenRouter → cleaned original text
- **Caching**: Instructions cached for performance
- **Error Resilience**: Graceful degradation through provider cascade
- **Independent Operation**: Works with any combination of AI providers available

**AI Instructions Template:**

```markdown
# AI Summarization Instructions

Create an executive summary of this release description for business stakeholders.

## INSTRUCTIONS:
- Remove all markdown formatting (##, **, *, etc.)
- Remove URLs and technical jargon
- Focus on business impact and user benefits
- Keep it concise (max 3-4 sentences)
- Write as continuous paragraph without section breaks
- Answer: What changed? Why does it matter? Who benefits?

## RELEASE DESCRIPTION:
${text}
```

#### 4. 🔍 Release Processing

**Enhanced Timeframe-Based Filtering**

- **Hours**: Filters releases published within last N hours (default: 24 hours)
- **Days**: Filters releases published within last N days
- **Date**: Filters releases published on a specific date (UTC)
- **Repository Filtering**: Single repository or comma-separated list

**Data Transformation**

```typescript
// Raw GitHub Release → Structured ReleaseInfo
{
  repository: "org/repo-name",
  tagName: "v1.2.3",
  name: "Version 1.2.3",
  publishedAt: "2024-01-15T10:30:00Z",
  description: "AI-generated executive summary",
  url: "https://github.com/org/repo/releases/tag/v1.2.3",
  author: "username",
  isPrerelease: false
}
```

**Enhanced Formatting Features:**

- **AI Summaries**: Executive summaries for business stakeholders
- **Clean Text**: Removes PR links (#123), commit hashes, URLs, and GitHub-specific patterns
- **Separate Messages**: Individual Slack messages per repository
- **Summary Tables**: Tabular overview for multiple repositories
- **Proper Wrapping**: Text wraps to fit column width with consistent indentation

#### 5. 📋 Message Formatting

**Separate Repository Messages**

```mermaid
graph TD
    A[Release Data] --> B[Group by Repository]
    B --> C[Generate Summary Header]
    C --> D[Create Summary Table]
    D --> E[Format Each Repository]
    E --> F[AI Summarization]
    F --> G[Wrap Text]
    G --> H[Create Message Array]
    
    style F fill:#f3e5f5,color:#000
    style H fill:#90caf9,color:#000
```

**Message Structure:**

1. **Summary Header**: Release statistics and timeframe
2. **Summary Table** (if multiple repositories): Repository | Version | Published At | URL
3. **Repository Messages**: Individual code blocks for each repository
   - Repository name
   - Release details (version, date, URL)
   - AI-generated executive summary

**Formatting Features:**

- **Monospace Alignment**: Code blocks for consistent Slack rendering
- **Consistent Indentation**: 18-space indentation for all content
- **Summary Tables**: Only shown for multiple repositories
- **Repository Headers**: Customized headers with repository names when filtering

#### 6. 📤 Slack Integration

**Multiple Message Flow**

```mermaid
graph LR
    A[Message Array] --> B[Summary Message]
    B --> C[Summary Table]
    C --> D[Repository Messages]
    D --> E[POST to Webhook]
    E --> F[Success/Error Handling]
    
    style B fill:#90caf9,color:#000
    style D fill:#ffd54f,color:#000
```

### Core Components

```ini
src/
├── 🎯 main.ts                 # Entry point & orchestration
├── 🤖 AI/                     # AI integration layer
│   ├── anthropic.ts          # Anthropic Claude client (primary)
│   ├── open-router.ts        # OpenRouter client & fallback orchestration
│   ├── instructions.md       # AI prompt templates
│   └── models.json           # OpenRouter fallback model definitions
├── 📁 core/                   # Business logic layer
│   ├── release.ts            # Release fetching & filtering with dual data sources
│   ├── repository.ts         # GitHub repository operations
│   ├── snowflake-releases.ts # Snowflake data fetching & mapping
│   ├── slack.ts              # Slack posting workflow
│   └── format.ts             # Message formatting & templates
├── 🔌 clients/               # External API clients
│   ├── github-graphql-client.ts # GitHub GraphQL interface
│   ├── slack-client.ts       # Slack webhook client
│   └── snowflake-client.ts   # Snowflake connection & SQL execution
├── 🛠️ utils/                 # Utilities & configuration
│   ├── config.ts             # Environment configuration with Snowflake & AI
│   ├── cli.ts                # Command-line interface
│   ├── logger.ts             # Contextual logging
│   └── process-handlers.ts   # Graceful shutdown
└── 📝 types/                 # TypeScript definitions
    ├── github.ts             # GitHub API types
    ├── release.ts            # Release data types
    ├── slack.ts              # Slack message types
    ├── snowflake.ts          # Snowflake connection & data types
    └── index.ts              # Shared type exports
```

## 🚀 Usage

### Environment Setup

```bash
# Required variables
export TOKEN_GITHUB="github_pat_your_token_here"
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."
export ORG_NAME="your-organization-name"

# AI Integration (Optional)
export ANTHROPIC_API_KEY="sk-ant-api03-your_anthropic_key_here"    # Primary AI provider
export ANTHROPIC_MODEL="claude-3-5-sonnet-20241022"                # Anthropic model
export OPENROUTER_API_KEY="sk-or-v1-your_openrouter_key_here"      # Fallback AI provider
export AI_MODEL="claude-3-5-sonnet-20241022"                       # OpenRouter model

# Snowflake Integration (Optional)
export SNOWFLAKE_CONFIG='{"account":"your-account","username":"user","password":"pass","database":"db","schema":"schema","warehouse":"wh"}'

# Basic Configuration
export NODE_ENV="production"          # development|production
export LOG_LEVEL="info"              # debug|info|warn|error
export HOURS_BACK="24"               # fetch releases from last N hours (default)
export DAYS_BACK="7"                 # fetch releases from last N days
export TARGET_DATE="2024-01-15"      # fetch releases from specific date (YYYY-MM-DD)
export START_DATE="2024-01-10"       # date range start (with END_DATE)
export END_DATE="2024-01-15"         # date range end (with START_DATE)
export REPOSITORIES="repo1,repo2"    # specific repositories to monitor
export INCLUDE_DESCRIPTIONS="false"   # include detailed descriptions (default: false)
```

### Command Line Usage

```bash
# Default: releases from last 24 hours
npm start

# Timeframe options
npm start -- --hours 6                # Last 6 hours
npm start -- --days 14                # Last 14 days
npm start -- --date 2025-07-14        # Specific date
npm start -- --date today             # Today's releases
npm start -- --date yesterday         # Yesterday's releases

# Repository filtering
npm start -- --repo repo-name         # Single repository
npm start -- --repos repo1,repo2,repo3 # Multiple repositories

# Content options
npm start -- --include-descriptions   # Include detailed descriptions (default behavior)
npm start -- --days 1                 # Summary table only (no detailed descriptions)

# Combined options
npm start -- --hours 24 --repo repo1  # Last 24 hours for specific repo
npm start -- --days 7 --repos repo1,repo2 # Last 7 days for multiple repos
npm start -- --days 1 --include-descriptions # Last day with detailed descriptions

# Show help
npm start -- --help
```

### GitHub Actions Integration

The service includes GitHub Action workflows for automated summaries:

```yaml
# .github/workflows/daily-releases.yml
name: Daily Release Summary
on:
  schedule:
    - cron: '0 9 * * *'  # 9:00 AM UTC daily
  workflow_dispatch:      # Manual trigger
```

## 🧪 Testing

Comprehensive test suite with 185+ tests covering:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# AI testing
npm run test:ai
```

## 📊 Configuration Reference

### Timeframe Configuration

| Type | Environment Variable | CLI Argument | Description | Example |
|------|---------------------|--------------|-------------|---------|
| `hours` | `HOURS_BACK` | `--hours` | Fetch releases from last N hours | `HOURS_BACK=24` (default) |
| `days` | `DAYS_BACK` | `--days` | Fetch releases from last N days | `DAYS_BACK=7` |
| `date` | `TARGET_DATE` | `--date` | Fetch releases from specific date | `TARGET_DATE=2024-01-15` |

### Repository Filtering

| Type | Environment Variable | CLI Argument | Description | Example |
|------|---------------------|--------------|-------------|---------|
| `single` | `REPOSITORIES` | `--repo` | Single repository | `--repo my-repo` |
| `multiple` | `REPOSITORIES` | `--repos` | Multiple repositories | `--repos repo1,repo2,repo3` |

### Content Options

| Type | Environment Variable | CLI Argument | Description | Example |
|------|---------------------|--------------|-------------|---------|
| `include descriptions` | `INCLUDE_DESCRIPTIONS` | `--include-descriptions` | Include detailed descriptions with AI summaries | `--include-descriptions` |
| `summary only` | `INCLUDE_DESCRIPTIONS=false` | (default when not specified) | Show only summary table, no detailed descriptions | `npm start -- --days 1` |

### Message Format

| Format | Description | Features |
|--------|-------------|----------|
| `Summary Header` | Overview with release statistics | Release count, stable/pre-release breakdown, repository count |
| `Summary Tables` | Tabular overview for multiple repositories | Repository | Version | Published At | URL |
| `Detailed Descriptions` | Individual repository messages with AI summaries | Monospace alignment, AI summaries, consistent indentation |

### Content Modes

| Mode | Description | Output |
|------|-------------|--------|
| `Summary Only` | Default behavior when `--include-descriptions` not specified | Summary header + summary table (if multiple repos) |
| `Full Content` | When `--include-descriptions` is specified | Summary header + summary table + detailed descriptions |

### AI Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `Primary Provider` | Anthropic Claude for high-quality summaries | `claude-3-5-sonnet-20241022` |
| `Fallback Provider` | OpenRouter for redundancy | `claude-3-5-sonnet-20241022` |
| `Instructions` | Prompt template location | `src/AI/instructions.md` |
| `Fallback Strategy` | Anthropic → OpenRouter → cleaned text | Multi-level degradation |
| `Model Configuration` | Environment-based selection | `ANTHROPIC_MODEL`, `AI_MODEL` |
| `Caching` | Instructions caching | Enabled |

### Data Source Configuration

| Setting | Description | Priority |
|---------|-------------|----------|
| `Primary Source` | Snowflake data warehouse | 1st choice |
| `Fallback Source` | GitHub GraphQL API | 2nd choice (automatic) |
| `Configuration` | JSON or individual env vars | `SNOWFLAKE_CONFIG` or `SNOWFLAKE_*` |
| `Connection Strategy` | Individual vars override JSON | Local dev flexibility |

## 🛠️ Development

### Setup

```bash
# Install dependencies
npm install

# Development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Lint & format
npm run lint
npm run format
```

### Project Scripts

```bash
npm run build          # Compile TypeScript + copy AI instructions
npm run start          # Run built application
npm run dev            # Development with ts-node
npm run test           # Run test suite
npm run test:coverage  # Run tests with coverage
npm run test:ai        # Test AI summarization
npm run lint           # ESLint checks
npm run format         # Prettier formatting
npm run clean          # Remove build artifacts
```

## 📈 Monitoring & Observability

### Logging Features

- **Contextual Logging**: Each run gets unique context identifier
- **Structured Format**: JSON-formatted logs for easy parsing
- **Performance Metrics**: API call timing and pagination statistics
- **AI Integration Logging**: Summarization success/failure tracking
- **Error Tracking**: Detailed error information with stack traces

### GitHub Actions Monitoring

- **Artifact Upload**: Logs uploaded on failure for debugging
- **Environment Validation**: Pre-flight checks for required variables
- **Failure Notifications**: Integration with GitHub notifications
- **AI Service Monitoring**: Tracking of Anthropic and OpenRouter API usage
- **Data Source Monitoring**: Snowflake vs GitHub API usage tracking
- **Fallback Behavior**: Monitoring of automatic fallback scenarios

---
