import Anthropic from '@anthropic-ai/sdk';
import { CodeIssue } from './types.js';
import * as fs from 'fs/promises';

export interface AIAnalysisResult {
  issues: CodeIssue[];
  summary: string;
  suggestions: string[];
  architecturalInsights?: string[];
  hasMore?: boolean; // For chunked responses
}

export interface AIFixResult {
  originalCode: string;
  fixedCode: string;
  explanation: string;
  confidence: number;
}

export class AIAnalyzer {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(apiKey: string, options?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }) {
    this.client = new Anthropic({ apiKey });
    this.model = options?.model || 'claude-sonnet-4-5-20250929';
    this.maxTokens = options?.maxTokens || 8192; // Claude Sonnet 4 maximum
    this.temperature = options?.temperature || 0.1;
  }

  async analyzeCode(
    content: string,
    filePath: string,
    context?: { projectType?: string; framework?: string }
  ): Promise<AIAnalysisResult> {
    let allIssues: CodeIssue[] = [];
    let currentChunk = 0;
    let hasMore = true;
    let summary = '';
    let suggestions: string[] = [];
    let architecturalInsights: string[] = [];

    // Collect all chunks
    while (hasMore && currentChunk < 10) { // Max 10 chunks to prevent infinite loops
      const prompt = this.buildAnalysisPrompt(content, filePath, context, currentChunk);

      const message = await this.client.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      });

      const response = message.content[0].type === 'text' ? message.content[0].text : '';
      const result = this.parseAnalysisResponse(response, filePath);
      
      // Accumulate results
      allIssues = allIssues.concat(result.issues);
      if (result.summary) summary = result.summary;
      if (result.suggestions) suggestions = suggestions.concat(result.suggestions);
      if (result.architecturalInsights) architecturalInsights = architecturalInsights.concat(result.architecturalInsights);
      
      hasMore = result.hasMore || false;
      currentChunk++;
      
      if (hasMore) {
        console.log(`     📦 Received chunk ${currentChunk}, fetching next...`);
      }
    }

    return {
      issues: allIssues,
      summary: summary || 'AI analysis completed',
      suggestions,
      architecturalInsights,
      hasMore: false, // Final result always complete
    };
  }

  async generateFix(
    code: string,
    issue: CodeIssue,
    context?: string
  ): Promise<AIFixResult> {
    const prompt = this.buildFixPrompt(code, issue, context);

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      temperature: this.temperature,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const response = message.content[0].type === 'text' ? message.content[0].text : '';
    return this.parseFixResponse(response, code);
  }

  async reviewArchitecture(
    files: Array<{ path: string; content: string }>,
    projectType?: string
  ): Promise<{
    overallQuality: number;
    insights: string[];
    recommendations: string[];
    securityConcerns: string[];
  }> {
    const prompt = this.buildArchitecturePrompt(files, projectType);

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192,
      temperature: this.temperature,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const response = message.content[0].type === 'text' ? message.content[0].text : '';
    return this.parseArchitectureResponse(response);
  }

  async explainCode(code: string, filePath: string): Promise<string> {
    const prompt = `Analyze this code and provide a clear explanation of what it does, its purpose, and any notable patterns or issues:

File: ${filePath}

\`\`\`
${code}
\`\`\`

Provide a concise but thorough explanation.`;

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192, // Claude Sonnet 4 maximum
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    return message.content[0].type === 'text' ? message.content[0].text : '';
  }

  private buildAnalysisPrompt(
    content: string,
    filePath: string,
    context?: { projectType?: string; framework?: string },
    chunkNumber: number = 0
  ): string {
    const contextInfo = context 
      ? `Project Type: ${context.projectType || 'Unknown'}\nFramework: ${context.framework || 'Unknown'}\n\n`
      : '';

    const chunkingInstruction = chunkNumber === 0 
      ? `\n\n**IMPORTANT - Response Chunking:**
If you find MORE than 25 issues, return ONLY the first 25 issues and set "hasMore": true.
If you find 25 or fewer issues, return ALL of them and set "hasMore": false.
This allows us to handle large responses in multiple API calls.`
      : `\n\n**CONTINUATION REQUEST (Chunk ${chunkNumber + 1}):**
This is a continuation. You previously reported issues 1-${chunkNumber * 25}.
Now report the NEXT batch of up to 25 issues (issues ${chunkNumber * 25 + 1}-${(chunkNumber + 1) * 25}).
Set "hasMore": true if more issues remain, false if this is the last batch.`;

    return `You are an expert code reviewer performing a thorough analysis of the following code.

${contextInfo}File: ${filePath}

\`\`\`
${content}
\`\`\`

Please analyze this code and identify ALL issues including:
1. **Security vulnerabilities** (injection, XSS, hardcoded secrets, etc.)
2. **Performance problems** (inefficient algorithms, memory leaks, unnecessary operations)
3. **Code quality issues** (duplication, complexity, maintainability)
4. **Best practices violations** (naming, structure, patterns)
5. **Type safety issues** (if TypeScript/typed language)
6. **Error handling problems**
7. **Accessibility issues** (if UI code)
8. **Testing gaps** (untestable code, missing edge cases)

For each issue, provide:
- Line number (approximate if needed)
- Severity: critical, high, medium, or low
- Category (Security, Performance, Code Quality, etc.)
- Clear description of the problem
- Specific suggestion for fixing it
- Whether it's auto-fixable (yes/no)${chunkingInstruction}

Format your response as JSON:
{
  "issues": [
    {
      "line": number,
      "severity": "critical|high|medium|low",
      "category": "string",
      "message": "string",
      "suggestedFix": "string",
      "autoFixable": boolean
    }
  ],
  "hasMore": boolean,
  "summary": "Brief overall assessment (only in last chunk)",
  "suggestions": ["General improvement suggestions (only in last chunk)"],
  "architecturalInsights": ["Higher-level observations (only in last chunk)"]
}`;
  }

  private buildFixPrompt(code: string, issue: CodeIssue, context?: string): string {
    return `You are an expert developer tasked with fixing a code issue.

${context ? `Context: ${context}\n\n` : ''}Original code:
\`\`\`
${code}
\`\`\`

Issue to fix:
- Line ${issue.line}: ${issue.message}
- Category: ${issue.category}
- Severity: ${issue.severity}
- Suggested approach: ${issue.suggestedFix}

Please provide:
1. The COMPLETE fixed code (not just the changed lines)
2. A clear explanation of what was changed and why
3. Your confidence level (0-100) that this fix is correct and safe

Format as JSON:
{
  "fixedCode": "complete fixed code here",
  "explanation": "detailed explanation of changes",
  "confidence": number (0-100)
}`;
  }

  private buildArchitecturePrompt(
    files: Array<{ path: string; content: string }>,
    projectType?: string
  ): string {
    const filesList = files.map(f => 
      `File: ${f.path}\n\`\`\`\n${f.content.slice(0, 2000)}\n\`\`\`\n`
    ).join('\n');

    return `You are a senior software architect reviewing a codebase.

${projectType ? `Project Type: ${projectType}\n\n` : ''}Files to review:

${filesList}

Provide a comprehensive architectural review including:
1. Overall code quality score (0-100)
2. Key architectural insights and patterns observed
3. Recommendations for improvements
4. Security concerns at the architectural level

Format as JSON:
{
  "overallQuality": number (0-100),
  "insights": ["insight 1", "insight 2", ...],
  "recommendations": ["recommendation 1", "recommendation 2", ...],
  "securityConcerns": ["concern 1", "concern 2", ...]
}`;
  }

  private parseAnalysisResponse(response: string, filePath: string): AIAnalysisResult {
    try {
      // Extract JSON from response (might be wrapped in markdown)
      let jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      let jsonText = jsonMatch[0];
      
      // Try to fix incomplete JSON by closing open arrays/objects
      try {
        JSON.parse(jsonText);
      } catch (parseError) {
        console.warn('Initial JSON parse failed, attempting to fix incomplete JSON...');
        
        // Count open/close brackets to detect incomplete JSON
        const openBraces = (jsonText.match(/\{/g) || []).length;
        const closeBraces = (jsonText.match(/\}/g) || []).length;
        const openBrackets = (jsonText.match(/\[/g) || []).length;
        const closeBrackets = (jsonText.match(/\]/g) || []).length;
        
        // Close incomplete arrays and objects
        if (openBrackets > closeBrackets) {
          // Remove trailing incomplete array element if it exists
          jsonText = jsonText.replace(/,\s*$/, '');
          jsonText += ']'.repeat(openBrackets - closeBrackets);
        }
        if (openBraces > closeBraces) {
          jsonText += '}'.repeat(openBraces - closeBraces);
        }
      }

      const parsed = JSON.parse(jsonText);

      // Convert to CodeIssue format
      const issues: CodeIssue[] = (parsed.issues || []).map((issue: any) => ({
        type: issue.severity === 'critical' || issue.severity === 'high' ? 'error' : 'warning',
        severity: issue.severity,
        category: issue.category,
        message: issue.message,
        file: filePath,
        line: issue.line || 1,
        suggestedFix: issue.suggestedFix,
        autoFixable: issue.autoFixable || false,
      }));

      return {
        issues,
        summary: parsed.summary || 'AI analysis completed',
        suggestions: parsed.suggestions || [],
        architecturalInsights: parsed.architecturalInsights || [],
        hasMore: parsed.hasMore || false,
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return {
        issues: [],
        summary: 'Failed to parse AI response',
        suggestions: [],
        architecturalInsights: [],
      };
    }
  }

  private parseFixResponse(response: string, originalCode: string): AIFixResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        originalCode,
        fixedCode: parsed.fixedCode || originalCode,
        explanation: parsed.explanation || 'No explanation provided',
        confidence: parsed.confidence || 0,
      };
    } catch (error) {
      console.error('Failed to parse fix response:', error);
      return {
        originalCode,
        fixedCode: originalCode,
        explanation: 'Failed to generate fix',
        confidence: 0,
      };
    }
  }

  private parseArchitectureResponse(response: string): {
    overallQuality: number;
    insights: string[];
    recommendations: string[];
    securityConcerns: string[];
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        overallQuality: parsed.overallQuality || 50,
        insights: parsed.insights || [],
        recommendations: parsed.recommendations || [],
        securityConcerns: parsed.securityConcerns || [],
      };
    } catch (error) {
      console.error('Failed to parse architecture response:', error);
      return {
        overallQuality: 0,
        insights: ['Failed to parse AI response'],
        recommendations: [],
        securityConcerns: [],
      };
    }
  }
}
