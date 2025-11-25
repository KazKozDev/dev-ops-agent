#!/usr/bin/env node

import { Command } from 'commander';
import { DevOpsAgent } from './agent.js';
import { AIDevOpsAgent } from './ai-agent.js';
import * as fs from 'fs/promises';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('dev-ops-agent')
  .description('AI-powered code review and automated bug-fixing agent')
  .version('2.0.0');

// AI Review Command
program
  .command('ai-review')
  .description('Perform AI-powered code review using Claude Sonnet 4')
  .argument('[path]', 'Path to analyze', '.')
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .option('-m, --mode <mode>', 'Analysis mode: fast, thorough, or hybrid', 'hybrid')
  .option('-a, --architecture', 'Include architectural analysis', false)
  .option('-o, --output <format>', 'Output format (console, json, markdown)', 'console')
  .option('-f, --file <path>', 'Save report to file')
  .action(async (targetPath: string, options: any) => {
    try {
      const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        console.error('❌ Error: ANTHROPIC_API_KEY is required for AI analysis.');
        console.error('   Set it via environment variable or use --api-key flag');
        console.error('   Get your key at: https://console.anthropic.com/\n');
        process.exit(1);
      }

      const agent = new AIDevOpsAgent(
        { targetPath },
        {
          useAI: true,
          aiApiKey: apiKey,
          mode: options.mode,
          architectureReview: options.architecture,
        }
      );

      const report = await agent.reviewCode();
      
      if (options.output === 'console') {
        agent.printReport(report);
      } else {
        const output = JSON.stringify(report, null, 2);
        
        if (options.file) {
          await fs.writeFile(options.file, output, 'utf-8');
          console.log(`\n✅ AI report saved to ${options.file}\n`);
        } else {
          console.log(output);
        }
      }

      if (report.summary.critical > 0 || report.summary.high > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error during AI code review:', error);
      process.exit(1);
    }
  });

// AI Fix Command
program
  .command('ai-fix')
  .description('Automatically fix bugs using AI-generated solutions')
  .argument('[path]', 'Path to fix', '.')
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .option('-d, --dry-run', 'Show what would be fixed without making changes')
  .action(async (targetPath: string, options: any) => {
    try {
      const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        console.error('❌ Error: ANTHROPIC_API_KEY is required for AI fixes.');
        console.error('   Set it via environment variable or use --api-key flag\n');
        process.exit(1);
      }

      const agent = new AIDevOpsAgent(
        { targetPath },
        { useAI: true, aiApiKey: apiKey }
      );

      if (options.dryRun) {
        console.log('🔍 AI Dry-run mode - no files will be modified\n');
        const report = await agent.reviewCode();
        const fixable = report.issues.filter(i => i.severity === 'high' || i.severity === 'critical');
        
        console.log(`\n📊 AI would attempt to fix ${fixable.length} high/critical issue(s)\n`);
        process.exit(0);
      }

      const result = await agent.applyAIFixes();
      
      console.log('\n' + '='.repeat(80));
      console.log('🤖 AI Fix Summary:');
      console.log(`  ✅ Fixed: ${result.fixed} issue(s)`);
      console.log(`  ❌ Failed: ${result.failed} issue(s)`);
      console.log('='.repeat(80) + '\n');

      if (result.details.length > 0) {
        console.log('Details:');
        result.details.forEach(d => {
          console.log(`\n  📄 ${d.file}`);
          console.log(`     ${d.issue}`);
          console.log(`     Confidence: ${d.confidence}%`);
          console.log(`     ${d.explanation.slice(0, 200)}...`);
        });
      }

      if (result.fixed > 0) {
        console.log('\n💡 Please review AI-generated changes and run tests!\n');
      }
    } catch (error) {
      console.error('❌ Error during AI bug fixing:', error);
      process.exit(1);
    }
  });

// AI Explain Command
program
  .command('explain')
  .description('Get AI explanation of a code file')
  .argument('<file>', 'File to explain')
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .action(async (file: string, options: any) => {
    try {
      const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        console.error('❌ Error: ANTHROPIC_API_KEY is required.');
        process.exit(1);
      }

      const agent = new AIDevOpsAgent(
        { targetPath: '.' },
        { useAI: true, aiApiKey: apiKey }
      );

      console.log(`🧠 AI analyzing ${file}...\n`);
      const explanation = await agent.explainCode(file);
      
      console.log('📖 Explanation:\n');
      console.log(explanation);
      console.log('');
    } catch (error) {
      console.error('❌ Error explaining code:', error);
      process.exit(1);
    }
  });

// Original Static Review Command
program
  .command('review')
  .description('Perform fast static code review (no AI)')
  .argument('[path]', 'Path to analyze', '.')
  .option('-o, --output <format>', 'Output format (console, json, markdown)', 'console')
  .option('-f, --file <path>', 'Save report to file')
  .action(async (targetPath: string, options: any) => {
    try {
      const agent = new DevOpsAgent({ targetPath, outputFormat: options.output as any });
      const report = await agent.reviewCode();
      
      if (options.output === 'console') {
        agent.printReport(report);
      } else {
        const output = await agent.exportReport(report, options.output as any);
        
        if (options.file) {
          await fs.writeFile(options.file, output, 'utf-8');
          console.log(`\n✅ Report saved to ${options.file}\n`);
        } else {
          console.log(output);
        }
      }

      if (report.summary.critical > 0 || report.summary.high > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error during code review:', error);
      process.exit(1);
    }
  });

// Original Static Fix Command
program
  .command('fix')
  .description('Automatically fix bugs using pattern-based rules (no AI)')
  .argument('[path]', 'Path to fix', '.')
  .option('-d, --dry-run', 'Show what would be fixed without making changes')
  .action(async (targetPath: string, options: any) => {
    try {
      const agent = new DevOpsAgent({ targetPath, autoFix: true });

      if (options.dryRun) {
        console.log('🔍 Running in dry-run mode...\n');
        const report = await agent.reviewCode();
        const fixable = report.issues.filter(i => i.autoFixable);
        
        console.log(`\n📊 Would fix ${fixable.length} issue(s):\n`);
        for (const issue of fixable) {
          console.log(`  - Line ${issue.line} in ${issue.file}`);
          console.log(`    ${issue.message}`);
          if (issue.suggestedFix) {
            console.log(`    💡 ${issue.suggestedFix}`);
          }
          console.log('');
        }
      } else {
        const result = await agent.applyFixes();
        
        console.log('\n' + '='.repeat(80));
        console.log('✅ Fix Summary:');
        console.log(`  Fixed: ${result.fixed} issue(s)`);
        console.log(`  Failed: ${result.failed} issue(s)`);
        console.log('='.repeat(80) + '\n');

        if (result.fixed > 0) {
          console.log('💡 Review the changes and run tests to verify everything works correctly.\n');
        }
      }
    } catch (error) {
      console.error('❌ Error during bug fixing:', error);
      process.exit(1);
    }
  });

program
  .command('rules')
  .description('List all available static analysis rules')
  .action(() => {
    const agent = new DevOpsAgent({ targetPath: '.' });
    const analyzer = (agent as any).analyzer;
    const rules = analyzer.getRules();

    console.log('\n📋 Available Static Analysis Rules:\n');
    
    for (const rule of rules) {
      console.log(`  ${rule.id}`);
      console.log(`    Name: ${rule.name}`);
      console.log(`    Category: ${rule.category}`);
      console.log(`    Severity: ${rule.severity}`);
      console.log('');
    }

    console.log(`Total: ${rules.length} static rules\n`);
    console.log('💡 For AI-powered analysis with context understanding, use: ai-review\n');
  });

program.parse();
