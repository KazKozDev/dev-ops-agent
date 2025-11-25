import { AnalyzerRule, CodeIssue } from './types.js';

export class CodeAnalyzer {
  private rules: AnalyzerRule[] = [];

  constructor() {
    this.initializeRules();
  }

  private initializeRules(): void {
    this.rules = [
      // Security Issues
      {
        id: 'no-eval',
        name: 'Avoid eval() usage',
        category: 'Security',
        severity: 'critical',
        check: (content: string, filePath: string) => {
          const issues: CodeIssue[] = [];
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (/\beval\s*\(/.test(line)) {
              issues.push({
                type: 'error',
                severity: 'critical',
                category: 'Security',
                message: 'Usage of eval() is dangerous and should be avoided',
                file: filePath,
                line: index + 1,
                code: line.trim(),
                suggestedFix: 'Consider using safer alternatives like JSON.parse() or Function constructor',
                autoFixable: false,
              });
            }
          });
          return issues;
        },
      },
      {
        id: 'no-console-log',
        name: 'Remove console.log statements',
        category: 'Code Quality',
        severity: 'low',
        check: (content: string, filePath: string) => {
          const issues: CodeIssue[] = [];
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (/console\.log\s*\(/.test(line) && !line.trim().startsWith('//')) {
              issues.push({
                type: 'warning',
                severity: 'low',
                category: 'Code Quality',
                message: 'console.log should be removed in production code',
                file: filePath,
                line: index + 1,
                code: line.trim(),
                suggestedFix: 'Remove or replace with proper logging framework',
                autoFixable: true,
              });
            }
          });
          return issues;
        },
      },
      {
        id: 'no-var',
        name: 'Use let/const instead of var',
        category: 'Best Practices',
        severity: 'medium',
        check: (content: string, filePath: string) => {
          const issues: CodeIssue[] = [];
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (/\bvar\s+\w+/.test(line) && !line.trim().startsWith('//')) {
              issues.push({
                type: 'warning',
                severity: 'medium',
                category: 'Best Practices',
                message: 'Use let or const instead of var',
                file: filePath,
                line: index + 1,
                code: line.trim(),
                suggestedFix: line.trim().replace(/\bvar\b/, 'const'),
                autoFixable: true,
              });
            }
          });
          return issues;
        },
      },
      {
        id: 'no-any-type',
        name: 'Avoid using any type in TypeScript',
        category: 'Type Safety',
        severity: 'medium',
        check: (content: string, filePath: string) => {
          if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
            return [];
          }
          const issues: CodeIssue[] = [];
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (/:\s*any\b/.test(line) && !line.trim().startsWith('//')) {
              issues.push({
                type: 'warning',
                severity: 'medium',
                category: 'Type Safety',
                message: 'Avoid using "any" type - use specific types instead',
                file: filePath,
                line: index + 1,
                code: line.trim(),
                suggestedFix: 'Define a proper interface or use unknown with type guards',
                autoFixable: false,
              });
            }
          });
          return issues;
        },
      },
      {
        id: 'no-empty-catch',
        name: 'Empty catch blocks',
        category: 'Error Handling',
        severity: 'high',
        check: (content: string, filePath: string) => {
          const issues: CodeIssue[] = [];
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/catch\s*\([^)]*\)\s*\{/.test(line)) {
              // Check if next line is just closing brace or empty
              let nextLineIndex = i + 1;
              while (nextLineIndex < lines.length && lines[nextLineIndex].trim() === '') {
                nextLineIndex++;
              }
              if (nextLineIndex < lines.length && lines[nextLineIndex].trim() === '}') {
                issues.push({
                  type: 'error',
                  severity: 'high',
                  category: 'Error Handling',
                  message: 'Empty catch block - errors are silently ignored',
                  file: filePath,
                  line: i + 1,
                  code: line.trim(),
                  suggestedFix: 'Add error logging or proper error handling',
                  autoFixable: false,
                });
              }
            }
          }
          return issues;
        },
      },
      {
        id: 'no-hardcoded-credentials',
        name: 'Detect hardcoded credentials',
        category: 'Security',
        severity: 'critical',
        check: (content: string, filePath: string) => {
          const issues: CodeIssue[] = [];
          const lines = content.split('\n');
          const patterns = [
            /password\s*[:=]\s*['"]/i,
            /api[_-]?key\s*[:=]\s*['"]/i,
            /secret\s*[:=]\s*['"]/i,
            /token\s*[:=]\s*['"]/i,
          ];
          lines.forEach((line, index) => {
            patterns.forEach(pattern => {
              if (pattern.test(line) && !line.trim().startsWith('//')) {
                issues.push({
                  type: 'error',
                  severity: 'critical',
                  category: 'Security',
                  message: 'Possible hardcoded credential detected',
                  file: filePath,
                  line: index + 1,
                  code: line.trim(),
                  suggestedFix: 'Use environment variables or secure secret management',
                  autoFixable: false,
                });
              }
            });
          });
          return issues;
        },
      },
      {
        id: 'no-todo-comments',
        name: 'Unresolved TODO comments',
        category: 'Code Quality',
        severity: 'low',
        check: (content: string, filePath: string) => {
          const issues: CodeIssue[] = [];
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (/\/\/\s*TODO/i.test(line) || /\/\*\s*TODO/i.test(line)) {
              issues.push({
                type: 'info',
                severity: 'low',
                category: 'Code Quality',
                message: 'Unresolved TODO comment found',
                file: filePath,
                line: index + 1,
                code: line.trim(),
                suggestedFix: 'Address the TODO or create a tracking issue',
                autoFixable: false,
              });
            }
          });
          return issues;
        },
      },
      {
        id: 'no-debugger',
        name: 'Remove debugger statements',
        category: 'Code Quality',
        severity: 'high',
        check: (content: string, filePath: string) => {
          const issues: CodeIssue[] = [];
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (/\bdebugger\b/.test(line) && !line.trim().startsWith('//')) {
              issues.push({
                type: 'error',
                severity: 'high',
                category: 'Code Quality',
                message: 'debugger statement should be removed',
                file: filePath,
                line: index + 1,
                code: line.trim(),
                suggestedFix: 'Remove the debugger statement',
                autoFixable: true,
              });
            }
          });
          return issues;
        },
      },
    ];
  }

  analyzeFile(content: string, filePath: string): CodeIssue[] {
    const allIssues: CodeIssue[] = [];
    
    for (const rule of this.rules) {
      const issues = rule.check(content, filePath);
      allIssues.push(...issues);
    }

    // Sort by severity and line number
    return allIssues.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      return severityDiff !== 0 ? severityDiff : a.line - b.line;
    });
  }

  getRules(): AnalyzerRule[] {
    return this.rules;
  }
}
