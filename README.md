# GitHub Release Digest

> Automated GitHub release summary service that fetches and posts daily/recent release summaries to Slack with AI-powered executive summaries

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-185%20passing-brightgreen.svg)](#testing)
[![AI](https://img.shields.io/badge/AI-Anthropic%20%2B%20OpenRouter-purple.svg)](#ai-integration)

## 🚀 Quick Start

GitHub Release Digest monitors GitHub repositories within an organization and automatically posts formatted release summaries to Slack channels with AI-generated executive summaries. Fetches data from Snowflake (preferred) with GitHub API fallback. Perfect for keeping teams updated on releases across multiple repositories with business-focused insights.

## ✨ Key Features

- 🤖 **AI-Powered Summaries**: Executive summaries using Anthropic (primary) + OpenRouter (fallback)
- 📊 **Snowflake Integration**: Primary data source with GitHub API fallback
- 🎯 **Repository Filtering**: Target specific repositories with `--repo` or `--repos` arguments
- 📋 **Separate Messages**: Individual Slack messages per repository for better readability
- 📈 **Summary Tables**: Tabular overview for multiple repositories
- ⚡ **Efficient Queries**: Direct GraphQL queries for targeted repository fetching
- 🕒 **Flexible Timeframes**: Hours, days, or specific date filtering
- 🔧 **Advanced CLI**: Combined timeframe and repository filtering options
- ⚙️ **Configurable AI Models**: Environment-based AI model selection

## 📋 Prerequisites

- **Node.js** 20+
- **npm** or **yarn**
- **GitHub Personal Access Token** with repository read permissions
- **Slack Webhook URL** for posting messages
- **AI API Keys** (optional): Anthropic API key (primary) and/or OpenRouter API key (fallback)
- **Snowflake Connection** (optional): Database credentials for primary data source

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/github-release-digest.git
cd github-release-digest
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the sample environment file and configure your variables:

```bash
cp .env.sample .env
```

The `.env.sample` file contains all available environment variables with detailed comments and examples.

Then edit the `.env` file with your actual values:

```bash
# Required Environment Variables
TOKEN_GITHUB=github_pat_your_token_here
SLACK_WEBHOOK_URL=slack_webhook_url
ORG_NAME=your-organization-name

# AI Summarization (Optional)
ANTHROPIC_API_KEY=sk-ant-api03-your_anthropic_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key_here
AI_MODEL=claude-3-5-sonnet-20241022

# Snowflake Data Source (Optional)
SNOWFLAKE_CONFIG={"account":"your-account","username":"user","password":"pass","database":"db","schema":"schema","warehouse":"wh"}

# Basic Configuration
NODE_ENV=development
LOG_LEVEL=info
HOURS_BACK=24
DAYS_BACK=7
TARGET_DATE=2024-01-15
REPOSITORIES=repo1,repo2,repo3
INCLUDE_DESCRIPTIONS=true
```

**Required Variables:**

- `TOKEN_GITHUB`: GitHub Personal Access Token ([How to create](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token))
- `SLACK_WEBHOOK_URL`: Slack Incoming Webhook URL ([How to create](https://api.slack.com/messaging/webhooks))
- `ORG_NAME`: GitHub organization name to monitor

**AI Integration (Optional):**

- `ANTHROPIC_API_KEY`: Anthropic API key for primary AI summarization ([Get API key](https://console.anthropic.com/))
- `ANTHROPIC_MODEL`: Anthropic model to use (default: `claude-3-5-sonnet-20241022`)
- `OPENROUTER_API_KEY`: OpenRouter API key for fallback AI summarization ([Get API key](https://openrouter.ai/))
- `AI_MODEL`: OpenRouter model to use (default: `claude-3-5-sonnet-20241022`)

**Snowflake Integration (Optional):**

- `SNOWFLAKE_CONFIG`: JSON string with connection details (recommended for GitHub Actions)
- Individual variables: `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_USERNAME`, `SNOWFLAKE_PASSWORD`, etc. (for local development)

**Basic Configuration:**

- `NODE_ENV`: Environment mode (`development` | `production`)
- `LOG_LEVEL`: Logging level (`debug` | `info` | `warn` | `error`)
- `HOURS_BACK`: Hours to look back for releases (default: 24)
- `DAYS_BACK`: Days to look back for releases (default: 7)
- `TARGET_DATE`: Specific date for releases (YYYY-MM-DD format)
- `REPOSITORIES`: Comma-separated list of specific repositories to monitor
- `INCLUDE_DESCRIPTIONS`: Include detailed descriptions with AI summaries (default: false)

## 🔨 Build

```bash
# Build TypeScript to JavaScript
npm run build

# Clean previous build
npm run clean

# Build after cleaning
npm run clean && npm run build
```

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (development)
npm run test:watch

# Test AI summarization
npm run test:ai

# Run a single test file
npm run test:file tests/your-test-file.test.ts
```

### Test Results

The test suite includes 185+ tests covering:

- ✅ Unit tests for all core components
- ✅ Integration tests for API interactions
- ✅ AI summarization functionality
- ✅ Error handling and edge cases
- ✅ CLI argument processing
- ✅ Configuration validation
- ✅ Repository filtering logic

---

## 🚀 Usage

### Development Mode

```bash
# Run with ts-node (no build required)
npm run dev

# Show help
npm run dev -- --help
```

### Production Mode

```bash
# Build and run
npm run build
npm start

# Or use the convenience script
npm run release-summary
```

### Command Line Options

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

## 🤖 AI Integration

### Dual AI Provider Strategy

The service uses a dual AI provider approach for reliable summarization:

- **Primary Provider**: Anthropic Claude for high-quality summaries
- **Fallback Provider**: OpenRouter for redundancy when Anthropic fails
- **Configurable Models**: Environment-based model selection for both providers
- **Business Focus**: Summaries written for non-technical stakeholders
- **Content Cleaning**: Removes markdown, URLs, and technical jargon
- **Concise Output**: Maximum 3-4 sentences per summary
- **Graceful Degradation**: Returns cleaned original text if both AI services fail
- **External Instructions**: AI prompts stored in `src/AI/instructions.md`

### AI Configuration

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

## 📊 Message Format

### Content Modes

The service supports two content modes:

1. **Summary Only** (default): Shows summary header and table only
2. **Full Content**: Includes detailed descriptions with AI summaries

### Message Structure

Each repository gets its own Slack message for better readability:

```ini
:bar_chart: RELEASE SUMMARY - Last 24 hours (2025-07-27 to 2025-07-28) - repo-name
Summary: 2 releases • 2 stable • 0 pre-release • 1 repositories

```

Repository | Version | Published At | URL
-----------|---------|--------------|-----
repo-name  | v1.2.3  | 2025-07-28   | https://github.com/...
repo-name  | v1.2.4  | 2025-07-28   | https://github.com/...

```text

```

repo-name:

                  | *v1.2.3 | 2025-07-28 10:30 UTC | https://github.com/...*
                  | *Summary:*
                  | This release introduces enhanced user authentication features
                  | with improved security protocols and streamlined login flow.

```md


For multiple repositories, a summary table is automatically generated:

- **Repository**: Repository name (shown in every row for simplicity)
- **Version**: Release version number
- **Published At**: Publication date and time
- **URL**: Direct link to the release


| Option | Description | Output |
|--------|-------------|--------|
| `--include-descriptions` | Include detailed descriptions with AI summaries | Summary header + table + detailed descriptions |
| Default (no flag) | Summary only mode | Summary header + table only |

**Example Output Modes:**

**Summary Only:**
```

:bar_chart: RELEASE SUMMARY - Last 24 hours (2025-07-27 to 2025-07-28)
Summary: 2 releases • 2 stable • 0 pre-release • 2 repositories

Repository | Version | Published At | URL
-----------|---------|--------------|-----
repo1      | v1.2.3  | 2025-07-28   | https://github.com/...
repo2      | v1.1.0  | 2025-07-28   | https://github.com/...

```sh

**Full Content (with `--include-descriptions`):**
```

:bar_chart: RELEASE SUMMARY - Last 24 hours (2025-07-27 to 2025-07-28)
Summary: 2 releases • 2 stable • 0 pre-release • 2 repositories

Repository | Version | Published At | URL
-----------|---------|--------------|-----
repo1      | v1.2.3  | 2025-07-28   | https://github.com/...
repo2      | v1.1.0  | 2025-07-28   | https://github.com/...

repo1:
| *v1.2.3 | 2025-07-28 10:30 UTC | https://github.com/...*
| *Summary:*
| This release introduces enhanced user authentication features
| with improved security protocols and streamlined login flow.

repo2:
| *v1.1.0 | 2025-07-28 14:15 UTC | https://github.com/...*
| *Summary:*
| Performance improvements and bug fixes for better stability.

```sh

## 🔧 Development Workflow


```bash
# Lint code
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check
```

### Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Run in development mode with ts-node |
| `npm run build` | Compile TypeScript to JavaScript + copy AI instructions |
| `npm run start` | Run the built application |
| `npm test` | Run test suite |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:ai` | Test AI summarization |
| `npm run lint` | Check code style |
| `npm run format` | Format code with Prettier |

### GitHub Actions (Recommended)

The project includes GitHub Actions for automated summaries:

1. **Release Digest** (`.github/workflows/release-digest.yml`)

   - Manual trigger with timeframe options (hours, days, date)
   - Customizable parameters for each timeframe type
   - Repository filtering support

2. **Biweekly Release Digest** (`.github/workflows/biweekly-release-digest.yml`)

   - Manual trigger with customizable days back
   - Simplified workflow for biweekly summaries

**Setup:**

1. **Fork the repository**
2. **Set repository secrets:**

   - `TOKEN_GITHUB`
   - `SLACK_WEBHOOK_URL`
   - `ANTHROPIC_API_KEY` (optional - primary AI provider)
   - `OPENROUTER_API_KEY` (optional - fallback AI provider)
   - `SNOWFLAKE_CONFIG` (optional - JSON string with Snowflake connection details)
   - `ORG_NAME` (as repository variable)

3. **Enable GitHub Actions**
4. **The workflows will run automatically or can be triggered manually**

## 📈 Performance & Monitoring

### Logging Features

- **Contextual Logging**: Each run gets unique context identifier
- **Structured Format**: JSON-formatted logs for easy parsing
- **Performance Metrics**: API call timing and pagination statistics
- **AI Integration Logging**: Summarization success/failure tracking for both providers
- **Error Tracking**: Detailed error information with stack traces
- **Data Source Monitoring**: Snowflake vs GitHub API usage tracking

### GitHub Actions Monitoring

- **Artifact Upload**: Logs uploaded on failure for debugging
- **Environment Validation**: Pre-flight checks for required variables
- **Failure Notifications**: Integration with GitHub notifications
- **AI Service Monitoring**: Tracking of Anthropic and OpenRouter API usage
- **Data Source Fallback**: Monitoring Snowflake → GitHub API fallback behavior

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
