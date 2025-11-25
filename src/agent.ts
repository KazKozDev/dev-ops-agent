import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { CodeAnalyzer } from './analyzer.js';
import { AgentConfig, CodeIssue, ReviewReport } from './types.js';

export class DevOpsAgent {
  private analyzer: CodeAnalyzer;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = {
      filePatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.min.js'],
      autoFix: false,
      outputFormat: 'console',
      ...config,
    };
    this.analyzer = new CodeAnalyzer();
  }

  async reviewCode(): Promise<ReviewReport> {
    console.log('🔍 Starting code review...\n');

    const files = await this.findFiles();
    console.log(`📁 Found ${files.length} files to analyze\n`);

    const allIssues: CodeIssue[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const issues = this.analyzer.analyzeFile(content, file);
        allIssues.push(...issues);

        if (issues.length > 0) {
          console.log(`📄 ${path.relative(this.config.targetPath, file)}: ${issues.length} issue(s)`);
        }
      } catch (error) {
        console.error(`❌ Error analyzing ${file}:`, error);
      }
    }

    const report = this.generateReport(allIssues, files.length);
    return report;
  }

  async applyFixes(): Promise<{ fixed: number; failed: number }> {
    console.log('🔧 Starting automated bug fixes...\n');

    const files = await this.findFiles();
    let fixed = 0;
    let failed = 0;

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const issues = this.analyzer.analyzeFile(content, file);
        const fixableIssues = issues.filter(issue => issue.autoFixable);

        if (fixableIssues.length > 0) {
          const fixedContent = await this.applyFixesToFile(content, fixableIssues);
          await fs.writeFile(file, fixedContent, 'utf-8');
          fixed += fixableIssues.length;
          console.log(`✅ Fixed ${fixableIssues.length} issue(s) in ${path.relative(this.config.targetPath, file)}`);
        }
      } catch (error) {
        console.error(`❌ Error fixing ${file}:`, error);
        failed++;
      }
    }

    return { fixed, failed };
  }

  private async applyFixesToFile(content: string, issues: CodeIssue[]): Promise<string> {
    let lines = content.split('\n');

    // Sort issues by line number in reverse order to maintain line numbers while fixing
    const sortedIssues = [...issues].sort((a, b) => b.line - a.line);

    for (const issue of sortedIssues) {
      const lineIndex = issue.line - 1;
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];

        // Apply specific fixes
        if (issue.category === 'Code Quality' && /console\.log/.test(line)) {
          // Remove console.log lines
          lines.splice(lineIndex, 1);
        } else if (issue.category === 'Best Practices' && /\bvar\s+\w+/.test(line)) {
          // Replace var with const
          lines[lineIndex] = line.replace(/\bvar\b/, 'const');
        } else if (issue.category === 'Code Quality' && /\bdebugger\b/.test(line)) {
          // Remove debugger statements
          lines.splice(lineIndex, 1);
        }
      }
    }

    return lines.join('\n');
  }

  private async findFiles(): Promise<string[]> {
    const patterns = this.config.filePatterns!.map(pattern => 
      path.join(this.config.targetPath, pattern)
    );

    const allFiles: string[] = [];
    
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        ignore: this.config.excludePatterns,
        nodir: true,
        absolute: true,
      });
      allFiles.push(...files);
    }

    // Remove duplicates
    return [...new Set(allFiles)];
  }

  private generateReport(issues: CodeIssue[], filesAnalyzed: number): ReviewReport {
    const summary = {
      totalIssues: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length,
      autoFixable: issues.filter(i => i.autoFixable).length,
    };

    return {
      summary,
      issues,
      filesAnalyzed,
      timestamp: new Date().toISOString(),
    };
  }

  printReport(report: ReviewReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 CODE REVIEW REPORT');
    console.log('='.repeat(80) + '\n');

    console.log('Summary:');
    console.log(`  Total Issues: ${report.summary.totalIssues}`);
    console.log(`  🔴 Critical: ${report.summary.critical}`);
    console.log(`  🟠 High: ${report.summary.high}`);
    console.log(`  🟡 Medium: ${report.summary.medium}`);
    console.log(`  🟢 Low: ${report.summary.low}`);
    console.log(`  🔧 Auto-fixable: ${report.summary.autoFixable}`);
    console.log(`  📁 Files Analyzed: ${report.filesAnalyzed}\n`);

    if (report.issues.length === 0) {
      console.log('✨ No issues found! Your code looks great!\n');
      return;
    }

    // Group issues by file
    const issuesByFile = new Map<string, CodeIssue[]>();
    for (const issue of report.issues) {
      const relativePath = path.relative(this.config.targetPath, issue.file);
      if (!issuesByFile.has(relativePath)) {
        issuesByFile.set(relativePath, []);
      }
      issuesByFile.get(relativePath)!.push(issue);
    }

    console.log('Issues by File:\n');
    for (const [file, issues] of issuesByFile) {
      console.log(`📄 ${file}`);
      for (const issue of issues) {
        const icon = this.getSeverityIcon(issue.severity);
        console.log(`  ${icon} Line ${issue.line}: [${issue.category}] ${issue.message}`);
        if (issue.code) {
          console.log(`     Code: ${issue.code}`);
        }
        if (issue.suggestedFix) {
          console.log(`     💡 Fix: ${issue.suggestedFix}`);
        }
        if (issue.autoFixable) {
          console.log(`     🔧 Auto-fixable: Yes`);
        }
        console.log('');
      }
    }

    console.log('='.repeat(80));
    console.log(`Generated at: ${new Date(report.timestamp).toLocaleString()}`);
    console.log('='.repeat(80) + '\n');

    if (report.summary.autoFixable > 0) {
      console.log(`💡 Run with --fix flag to automatically fix ${report.summary.autoFixable} issue(s)\n`);
    }
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  async exportReport(report: ReviewReport, format: 'json' | 'markdown'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    }

    // Markdown format
    let md = '# Code Review Report\n\n';
    md += `**Generated:** ${new Date(report.timestamp).toLocaleString()}\n\n`;
    md += '## Summary\n\n';
    md += `- **Total Issues:** ${report.summary.totalIssues}\n`;
    md += `- **Critical:** ${report.summary.critical}\n`;
    md += `- **High:** ${report.summary.high}\n`;
    md += `- **Medium:** ${report.summary.medium}\n`;
    md += `- **Low:** ${report.summary.low}\n`;
    md += `- **Auto-fixable:** ${report.summary.autoFixable}\n`;
    md += `- **Files Analyzed:** ${report.filesAnalyzed}\n\n`;

    if (report.issues.length > 0) {
      md += '## Issues\n\n';
      const issuesByFile = new Map<string, CodeIssue[]>();
      for (const issue of report.issues) {
        const relativePath = path.relative(this.config.targetPath, issue.file);
        if (!issuesByFile.has(relativePath)) {
          issuesByFile.set(relativePath, []);
        }
        issuesByFile.get(relativePath)!.push(issue);
      }

      for (const [file, issues] of issuesByFile) {
        md += `### ${file}\n\n`;
        for (const issue of issues) {
          md += `- **Line ${issue.line}** [${issue.severity.toUpperCase()}] [${issue.category}]\n`;
          md += `  - ${issue.message}\n`;
          if (issue.code) {
            md += `  - Code: \`${issue.code}\`\n`;
          }
          if (issue.suggestedFix) {
            md += `  - **Fix:** ${issue.suggestedFix}\n`;
          }
          if (issue.autoFixable) {
            md += `  - 🔧 Auto-fixable\n`;
          }
          md += '\n';
        }
      }
    }

    return md;
  }
}
