#!/usr/bin/env node

import { Command } from 'commander';
import { DevOpsAgent } from './agent.js';
import * as fs from 'fs/promises';

const program = new Command();

program
  .name('dev-ops-agent')
  .description('Technical agent performing code reviews and automated bug-fixing proposals')
  .version('1.0.0');

program
  .command('review')
  .description('Perform code review on a directory')
  .argument('[path]', 'Path to analyze', '.')
  .option('-o, --output <format>', 'Output format (console, json, markdown)', 'console')
  .option('-f, --file <path>', 'Save report to file')
  .action(async (targetPath: string, options) => {
    try {
      const agent = new DevOpsAgent({
        targetPath,
        outputFormat: options.output as any,
      });

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

      // Exit with error code if critical or high severity issues found
      if (report.summary.critical > 0 || report.summary.high > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error during code review:', error);
      process.exit(1);
    }
  });

program
  .command('fix')
  .description('Automatically fix bugs in a directory')
  .argument('[path]', 'Path to fix', '.')
  .option('-d, --dry-run', 'Show what would be fixed without making changes')
  .action(async (targetPath: string, options) => {
    try {
      const agent = new DevOpsAgent({
        targetPath,
        autoFix: true,
      });

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
  .description('List all available analysis rules')
  .action(() => {
    const agent = new DevOpsAgent({ targetPath: '.' });
    const analyzer = (agent as any).analyzer;
    const rules = analyzer.getRules();

    console.log('\n📋 Available Analysis Rules:\n');
    
    for (const rule of rules) {
      console.log(`  ${rule.id}`);
      console.log(`    Name: ${rule.name}`);
      console.log(`    Category: ${rule.category}`);
      console.log(`    Severity: ${rule.severity}`);
      console.log('');
    }

    console.log(`Total: ${rules.length} rules\n`);
  });

program.parse();
