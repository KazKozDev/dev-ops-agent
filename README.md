# DevOps Agent

AI-powered code analysis and automated bug fixing using Claude Sonnet 4.5.

## Overview

DevOps Agent combines static pattern analysis with AI-powered deep code review to identify security vulnerabilities, performance issues, code quality problems, and architectural concerns. It can automatically fix critical issues with high confidence.

## Key Features

**Dual Analysis Modes**
- Static analysis: Fast pattern-based detection (8 rules)
- AI analysis: Deep semantic understanding via Claude Sonnet 4.5
- Hybrid mode: Combines both for comprehensive coverage

**Intelligent Chunking**
- Automatically splits large responses into manageable chunks
- Handles files with 100+ issues without token limit errors
- Sequential processing maintains context across chunks

**Auto-Fix Capability**
- AI generates complete fixed code with explanations
- Confidence scoring (0-100%) for each fix
- Applies fixes sequentially to maintain file consistency
- Dry-run mode for preview before applying changes

**Multiple Output Formats**
- Console (default): Formatted with severity indicators
- JSON: Structured data for CI/CD integration
- Markdown: Detailed reports for documentation

## Installation

```bash
npm install
npm run build
```

For global access:
```bash
npm link
```

## Configuration

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-api03-...
```

Or create `.env` file:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

## Usage

### AI-Powered Code Review

```bash
# Fast mode (static analysis only, free)
node dist/cli-ai.js ai-review ./src --mode fast

# Thorough mode (AI only, ~$1-2 per run)
node dist/cli-ai.js ai-review ./src --mode thorough

# Hybrid mode (both static + AI, ~$0.50-1)
node dist/cli-ai.js ai-review ./src --mode hybrid

# Save report to file
node dist/cli-ai.js ai-review ./src --mode thorough --output json --file report.json
```

### Automated Bug Fixing

```bash
# Preview fixes without applying (dry-run)
node dist/cli-ai.js ai-fix ./src --dry-run

# Apply AI-generated fixes (only high/critical issues)
node dist/cli-ai.js ai-fix ./src

# Fix specific file
node dist/cli-ai.js ai-fix ./src/auth.js
```

### Code Explanation

```bash
# Get AI explanation of code functionality
node dist/cli-ai.js explain ./src/complex-module.js
```

### Static Analysis (Legacy)

```bash
# Fast pattern-based review (no API key needed)
node dist/cli.js review ./src

# Auto-fix static issues
node dist/cli.js fix ./src --dry-run
```

## What It Detects

### Static Analysis (Pattern-Based)
- eval() usage
- Hardcoded credentials (API keys, passwords, tokens)
- var instead of let/const
- console.log and debugger statements
- Empty catch blocks
- TypeScript any types
- TODO comments

### AI Analysis (Semantic Understanding)
- SQL injection vulnerabilities
- XSS (Cross-Site Scripting) attacks
- CSRF vulnerabilities
- Race conditions in async code
- Memory leaks (event listeners, closures)
- N+1 query problems
- Uncontrolled resource consumption
- Missing input validation
- Information disclosure
- Missing rate limiting
- Authentication/authorization issues
- Business logic flaws
- Performance bottlenecks
- Architectural problems

## Example Output

```
AI-POWERED CODE REVIEW REPORT

Summary:
  Total Issues: 148
  Critical: 22
  High: 45
  Medium: 49
  Low: 32
  Auto-fixable: 32
  Files Analyzed: 2

Issues by File:

sample-code.js
  Line 5: [Security] Use of eval() with user input creates arbitrary code execution vulnerability
     Fix: Remove eval() entirely. Use JSON.parse() for JSON data or redesign to avoid dynamic code execution.

  Line 9: [Security] Hardcoded API key detected in source code
     Fix: Move to environment variables: const apiKey = process.env.API_KEY;

advanced-test.js
  Line 7: [Security] SQL Injection vulnerability - user input directly interpolated into query
     Fix: Use parameterized queries: const query = 'SELECT * FROM users WHERE id = ?';

  Line 12: [Concurrency] Race condition in withdraw() function - multiple calls can corrupt balance
     Fix: Implement mutex locking or database transactions to ensure atomic operations.

  Line 22: [Performance] Memory leak - event listeners never removed
     Fix: Store bound references and call removeEventListener in cleanup method.

  Line 37: [Performance] N+1 query problem - fetches posts individually for each user
     Fix: Use eager loading or single query with JOIN to fetch all data at once.
```

## How It Works

### Chunked Response Handling

When analyzing complex files, Claude may find 50+ issues. The system automatically:

1. Instructs Claude to return max 10 issues per response with `hasMore: true` flag
2. Makes follow-up requests: "Continue from issue #11"
3. Repeats until `hasMore: false`
4. Combines all chunks into single comprehensive report

This prevents token limit errors and ensures complete analysis.

### Fix Application Process

AI fixes are applied sequentially to maintain consistency:

1. Analyze code and identify high/critical issues
2. For each issue:
   - Generate complete fixed code (not just diff)
   - Calculate confidence score (0-100%)
   - Apply if confidence > 70%
   - Update working content for next fix
3. Write final result to file

Each fix builds on previous fixes, preventing conflicts.

## Architecture

```
src/
├── ai-analyzer.ts       # Claude API integration, chunking logic
├── ai-agent.ts          # Orchestrates static + AI analysis
├── cli-ai.ts            # AI-powered CLI commands
├── analyzer.ts          # Static pattern rules
├── agent.ts             # Basic agent (legacy)
├── cli.ts               # Static CLI (legacy)
└── types.ts             # TypeScript definitions
```

**Key Components:**

- `AIAnalyzer`: Handles Claude API calls, response parsing, chunking
- `AIDevOpsAgent`: Combines static and AI analysis, manages fix application
- `CodeAnalyzer`: Pattern-based static analysis (regex rules)

## CI/CD Integration

### GitHub Actions

```yaml
name: AI Code Review
on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - name: AI Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          node dist/cli-ai.js ai-review ./src --mode thorough --output json --file review.json
      - uses: actions/upload-artifact@v3
        with:
          name: code-review
          path: review.json
```

### Pre-commit Hook

```bash
#!/bin/sh
# .git/hooks/pre-commit

export ANTHROPIC_API_KEY="your-key"
node dist/cli-ai.js ai-review ./src --mode fast

if [ $? -ne 0 ]; then
  echo "Critical issues found. Fix before committing."
  exit 1
fi
```

## Performance & Cost

### Analysis Modes

| Mode | Speed | Cost | Use Case |
|------|-------|------|----------|
| Fast | < 1s | Free | Quick checks, CI/CD, pre-commit |
| Thorough | 1-3 min | $1-2 | Deep review, security audit |
| Hybrid | 1-2 min | $0.50-1 | Balanced coverage |

### Token Usage

- Small file (~200 lines): ~2,000 tokens
- Medium file (~500 lines): ~5,000 tokens
- Large file (~1000 lines): ~10,000 tokens (chunked)
- Chunking prevents timeout errors on complex files

### Recommendations

- Use `fast` mode for frequent checks (CI/CD, git hooks)
- Use `thorough` mode for weekly audits or major changes
- Use `hybrid` mode for pull request reviews
- Run AI analysis on changed files only to reduce costs

## Limitations

- AI analysis requires valid Anthropic API key
- Fixes require manual review before production deployment
- Pattern-based analysis may produce false positives
- AI may miss context-specific business logic issues
- Large files (>2000 lines) may need multiple chunks
- Confidence scores are estimates, not guarantees
- Fix generation takes 5-10 seconds per issue

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test
```

## License

MIT
