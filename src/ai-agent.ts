import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { AIAnalyzer, AIAnalysisResult } from './ai-analyzer.js';
import { CodeAnalyzer } from './analyzer.js';
import { AgentConfig, CodeIssue, ReviewReport } from './types.js';

export interface AIReviewOptions {
  useAI: boolean;
  aiApiKey?: string;
  mode?: 'fast' | 'thorough' | 'hybrid';
  architectureReview?: boolean;
}

export class AIDevOpsAgent {
  private aiAnalyzer?: AIAnalyzer;
  private staticAnalyzer: CodeAnalyzer;
  private config: AgentConfig;
  private aiOptions: AIReviewOptions;

  constructor(config: AgentConfig, aiOptions: AIReviewOptions) {
    this.config = {
      filePatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.min.js'],
      autoFix: false,
      outputFormat: 'console',
      ...config,
    };
    this.aiOptions = aiOptions;
    this.staticAnalyzer = new CodeAnalyzer();

    if (aiOptions.useAI && aiOptions.aiApiKey) {
      this.aiAnalyzer = new AIAnalyzer(aiOptions.aiApiKey);
    }
  }

  async reviewCode(): Promise<ReviewReport & { aiInsights?: any }> {
    const mode = this.aiOptions.mode || 'hybrid';
    
    console.log(`🤖 Starting ${mode.toUpperCase()} code review...\n`);

    const files = await this.findFiles();
    console.log(`📁 Found ${files.length} files to analyze\n`);

    let allIssues: CodeIssue[] = [];
    const aiInsights: any = {
      architecturalReview: null,
      fileInsights: [],
    };

    if (mode === 'fast' || mode === 'hybrid') {
      console.log('⚡ Running fast static analysis...\n');
      allIssues = await this.runStaticAnalysis(files);
    }

    if (mode === 'thorough' || mode === 'hybrid') {
      if (!this.aiAnalyzer) {
        console.log('⚠️  AI analysis requested but no API key provided. Skipping AI analysis.\n');
      } else {
        console.log('🧠 Running AI-powered deep analysis...\n');
        const aiIssues = await this.runAIAnalysis(files, aiInsights);
        
        // Merge and deduplicate issues
        allIssues = this.mergeIssues(allIssues, aiIssues);
      }
    }

    // Architecture review (if enabled and AI available)
    if (this.aiOptions.architectureReview && this.aiAnalyzer && files.length > 0) {
      console.log('🏗️  Running architectural analysis...\n');
      aiInsights.architecturalReview = await this.runArchitectureReview(files.slice(0, 10));
    }

    const report = this.generateReport(allIssues, files.length);
    return {
      ...report,
      aiInsights: aiInsights.architecturalReview || aiInsights.fileInsights.length > 0 ? aiInsights : undefined,
    };
  }

  async applyAIFixes(): Promise<{ fixed: number; failed: number; details: any[] }> {
    if (!this.aiAnalyzer) {
      console.log('❌ AI fixes require an API key. Please set ANTHROPIC_API_KEY.\n');
      return { fixed: 0, failed: 0, details: [] };
    }

    console.log('🤖 Starting AI-powered bug fixes...\n');

    const files = await this.findFiles();
    let fixed = 0;
    let failed = 0;
    const details: any[] = [];

    for (const file of files) {
      try {
        let content = await fs.readFile(file, 'utf-8');
        
        // First, identify issues
        const result = await this.aiAnalyzer.analyzeCode(content, file);
        const fixableIssues = result.issues.filter(issue => 
          issue.severity === 'high' || issue.severity === 'critical'
        );

        if (fixableIssues.length === 0) continue;

        console.log(`\n📄 Processing ${path.relative(this.config.targetPath, file)}...`);

        for (const issue of fixableIssues) {
          try {
            console.log(`  🔧 Fixing: ${issue.message}`);
            
            const fix = await this.aiAnalyzer.generateFix(content, issue);
            
            if (fix.confidence > 70) {
              await fs.writeFile(file, fix.fixedCode, 'utf-8');
              content = fix.fixedCode; // Update content for next fix
              console.log(`  ✅ Fixed with ${fix.confidence}% confidence`);
              console.log(`     ${fix.explanation.slice(0, 100)}...`);
              
              fixed++;
              details.push({
                file,
                issue: issue.message,
                confidence: fix.confidence,
                explanation: fix.explanation,
              });
            } else {
              console.log(`  ⚠️  Skipped (confidence too low: ${fix.confidence}%)`);
              failed++;
            }
          } catch (error) {
            console.log(`  ❌ Failed to fix: ${error}`);
            failed++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error);
        failed++;
      }
    }

    return { fixed, failed, details };
  }

  async explainCode(filePath: string): Promise<string> {
    if (!this.aiAnalyzer) {
      return 'AI explanation requires an API key. Please set ANTHROPIC_API_KEY.';
    }

    const content = await fs.readFile(filePath, 'utf-8');
    return await this.aiAnalyzer.explainCode(content, filePath);
  }

  private async runStaticAnalysis(files: string[]): Promise<CodeIssue[]> {
    const allIssues: CodeIssue[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const issues = this.staticAnalyzer.analyzeFile(content, file);
        allIssues.push(...issues);

        if (issues.length > 0) {
          console.log(`  📄 ${path.relative(this.config.targetPath, file)}: ${issues.length} issue(s)`);
        }
      } catch (error) {
        console.error(`  ❌ Error analyzing ${file}:`, error);
      }
    }

    return allIssues;
  }

  private async runAIAnalysis(files: string[], insights: any): Promise<CodeIssue[]> {
    if (!this.aiAnalyzer) return [];

    const allIssues: CodeIssue[] = [];
    const maxFilesForAI = 20; // Limit to avoid huge API costs
    const filesToAnalyze = files.slice(0, maxFilesForAI);

    for (const file of filesToAnalyze) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        
        // Skip very large files
        if (content.length > 50000) {
          console.log(`  ⏭️  Skipping ${path.basename(file)} (too large for AI analysis)`);
          continue;
        }

        console.log(`  🧠 AI analyzing ${path.basename(file)}...`);
        
        const result = await this.aiAnalyzer.analyzeCode(content, file);
        allIssues.push(...result.issues);

        if (result.architecturalInsights && result.architecturalInsights.length > 0) {
          insights.fileInsights.push({
            file,
            insights: result.architecturalInsights,
          });
        }

        console.log(`     Found ${result.issues.length} AI-detected issue(s)`);
        
        // Rate limiting - small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`  ❌ AI analysis error for ${file}:`, error);
      }
    }

    if (files.length > maxFilesForAI) {
      console.log(`\n  ℹ️  AI analysis limited to ${maxFilesForAI} files. Use static analysis for complete coverage.\n`);
    }

    return allIssues;
  }

  private async runArchitectureReview(files: string[]): Promise<any> {
    if (!this.aiAnalyzer) return null;

    try {
      const fileContents = await Promise.all(
        files.map(async file => ({
          path: file,
          content: await fs.readFile(file, 'utf-8'),
        }))
      );

      const review = await this.aiAnalyzer.reviewArchitecture(fileContents);
      
      console.log(`\n🏗️  Architecture Quality Score: ${review.overallQuality}/100\n`);
      
      if (review.insights.length > 0) {
        console.log('💡 Key Insights:');
        review.insights.forEach(insight => console.log(`   - ${insight}`));
        console.log('');
      }

      return review;
    } catch (error) {
      console.error('❌ Architecture review failed:', error);
      return null;
    }
  }

  private mergeIssues(staticIssues: CodeIssue[], aiIssues: CodeIssue[]): CodeIssue[] {
    const merged = [...staticIssues];
    const seen = new Set(staticIssues.map(i => `${i.file}:${i.line}:${i.message}`));

    for (const issue of aiIssues) {
      const key = `${issue.file}:${issue.line}:${issue.message}`;
      if (!seen.has(key)) {
        merged.push(issue);
        seen.add(key);
      }
    }

    return merged.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      return severityDiff !== 0 ? severityDiff : a.line - b.line;
    });
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

  printReport(report: ReviewReport & { aiInsights?: any }): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 AI-POWERED CODE REVIEW REPORT');
    console.log('='.repeat(80) + '\n');

    console.log('Summary:');
    console.log(`  Total Issues: ${report.summary.totalIssues}`);
    console.log(`  🔴 Critical: ${report.summary.critical}`);
    console.log(`  🟠 High: ${report.summary.high}`);
    console.log(`  🟡 Medium: ${report.summary.medium}`);
    console.log(`  🟢 Low: ${report.summary.low}`);
    console.log(`  🔧 Auto-fixable: ${report.summary.autoFixable}`);
    console.log(`  📁 Files Analyzed: ${report.filesAnalyzed}\n`);

    // Architecture insights
    if (report.aiInsights?.architecturalReview) {
      const arch = report.aiInsights.architecturalReview;
      console.log('🏗️  Architecture Review:');
      console.log(`   Quality Score: ${arch.overallQuality}/100\n`);
      
      if (arch.securityConcerns.length > 0) {
        console.log('   🔒 Security Concerns:');
        arch.securityConcerns.forEach((c: string) => console.log(`      - ${c}`));
        console.log('');
      }

      if (arch.recommendations.length > 0) {
        console.log('   💡 Recommendations:');
        arch.recommendations.slice(0, 5).forEach((r: string) => console.log(`      - ${r}`));
        console.log('');
      }
    }

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
      for (const issue of issues.slice(0, 10)) { // Limit display
        const icon = this.getSeverityIcon(issue.severity);
        console.log(`  ${icon} Line ${issue.line}: [${issue.category}] ${issue.message}`);
        if (issue.suggestedFix) {
          console.log(`     💡 ${issue.suggestedFix.slice(0, 100)}${issue.suggestedFix.length > 100 ? '...' : ''}`);
        }
        console.log('');
      }
      if (issues.length > 10) {
        console.log(`  ... and ${issues.length - 10} more issues\n`);
      }
    }

    console.log('='.repeat(80));
    console.log(`Generated at: ${new Date(report.timestamp).toLocaleString()}`);
    console.log('='.repeat(80) + '\n');

    if (report.summary.autoFixable > 0) {
      console.log(`💡 Run with --ai-fix flag to use AI for intelligent fixes\n`);
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
}
