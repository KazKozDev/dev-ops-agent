export interface CodeIssue {
  type: 'error' | 'warning' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  file: string;
  line: number;
  column?: number;
  code?: string;
  suggestedFix?: string;
  autoFixable: boolean;
}

export interface ReviewReport {
  summary: {
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    autoFixable: number;
  };
  issues: CodeIssue[];
  filesAnalyzed: number;
  timestamp: string;
}

export interface AnalyzerRule {
  id: string;
  name: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  check: (content: string, filePath: string) => CodeIssue[];
}

export interface AgentConfig {
  targetPath: string;
  filePatterns?: string[];
  excludePatterns?: string[];
  autoFix?: boolean;
  outputFormat?: 'console' | 'json' | 'markdown';
}
