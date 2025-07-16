# GitHub Release Digest

> Automated GitHub release summary service that fetches and posts daily/recent release summaries to Slack

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-185%20passing-brightgreen.svg)](#testing)

## 🚀 Quick Start

GitHub Release Digest monitors GitHub repositories within an organization and automatically posts formatted release summaries to Slack channels. Perfect for keeping teams updated on releases across multiple repositories.

## 📋 Prerequisites

- **Node.js** 18+
- **npm** or **yarn**
- **GitHub Personal Access Token** with repository read permissions
- **Slack Webhook URL** for posting messages

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

Create a `.env` file in the root directory:

```bash
# Required Environment Variables
GITHUB_TOKEN=github_pat_your_token_here
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...
ORG_NAME=your-organization-name

# Optional Configuration
NODE_ENV=development
LOG_LEVEL=info
RELEASE_MODE=recent
HOURS_BACK=24
```

**Required Variables:**

- `GITHUB_TOKEN`: GitHub Personal Access Token ([How to create](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token))
- `SLACK_WEBHOOK_URL`: Slack Incoming Webhook URL ([How to create](https://api.slack.com/messaging/webhooks))
- `ORG_NAME`: GitHub organization name to monitor

**Optional Variables:**

- `NODE_ENV`: Environment mode (`development` | `production`)
- `LOG_LEVEL`: Logging level (`debug` | `info` | `warn` | `error`)
- `RELEASE_MODE`: Default mode (`recent` | `daily`)
- `HOURS_BACK`: Hours to look back for recent releases (default: 24)

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

# Run a single test file
npm run test:file tests/your-test-file.test.ts

Replace `your-test-file.test.ts` with the name of the test file you want to run.  

```

### Test Results

The test suite includes 185+ tests covering:

- ✅ Unit tests for all core components
- ✅ Integration tests for API interactions
- ✅ Error handling and edge cases
- ✅ CLI argument processing
- ✅ Configuration validation

---

## 🚀 Usage

### Development Mode

```bash
# Run with ts-node (no build required)
npm run dev

# Run with specific arguments
npm run dev -- --hours 48
npm run dev -- --date today

# More options for dev
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
# Recent releases (last 24 hours)
npm start

# Recent releases (custom hours)
npm start -- --hours 48

# Daily releases (today)
npm start -- --date today

# Daily releases (specific date)  
npm start -- --date 2024-01-15

# Daily releases (yesterday)
npm start -- --date yesterday

# Show help
npm start -- --help
```

## 🔧 Development Workflow

### Code Quality

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
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run start` | Run the built application |
| `npm test` | Run test suite |
| `npm run test:coverage` | Run tests with coverage |
| `npm run lint` | Check code style |
| `npm run format` | Format code |
| `npm run clean` | Remove build artifacts |

## 🏗️ Project Structure

```ini
github-release-digest/
├── 📁 src/                    # Source code
│   ├── main.ts               # Application entry point
│   ├── core/                 # Business logic
│   ├── clients/              # API clients
│   ├── utils/                # Utilities
│   └── types/                # TypeScript definitions
├── 📁 tests/                 # Test files
├── 📁 dist/                  # Built JavaScript (after npm run build)
├── 📁 .github/workflows/     # GitHub Actions
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── .eslintrc.json           # ESLint configuration
└── README.md                # This file
```

## 🚀 Deployment

### GitHub Actions (Recommended)

The project includes a GitHub Action for automated daily summaries:

1. **Fork the repository**
2. **Set repository secrets:**

   - `GITHUB_TOKEN`
   - `SLACK_WEBHOOK_URL`
   - `ORG_NAME`

3. **Enable GitHub Actions**
4. **The workflow runs daily at 9:00 AM UTC**

### Manual Deployment

```bash
# Production build
NODE_ENV=production npm run build

# Run the service
NODE_ENV=production npm start
```

## 🔍 Troubleshooting

### Common Issues

**Build Errors:**

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Test Failures:**

```bash
# Check for missing environment variables
npm run test -- --verbose
```

**TypeScript Errors:**

```bash
# Check TypeScript configuration
npx tsc --noEmit
```

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug npm run dev
```

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed architecture and business logic
- **[Package.json](./package.json)** - Dependencies and scripts
- **[TypeScript Config](./tsconfig.json)** - TypeScript settings

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Run linting (`npm run lint`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

---

**Need help?** Check out [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed technical documentation.
