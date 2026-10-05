import type { ConfigIssue } from '../@types/index.js';

/** Ошибка загрузки конфигурации с перечнем проблем: источник, путь в дереве, причина. */
export class ConfigError extends Error {
    public readonly issues: readonly ConfigIssue[];

    constructor(issues: readonly ConfigIssue[], summary = 'Некорректная конфигурация') {
        super(`${summary}:\n${issues.map(formatIssue).join('\n')}`);
        this.name = 'ConfigError';
        this.issues = issues;
    }
}

function formatIssue(issue: ConfigIssue): string {
    const location = issue.path === '' ? issue.source : `${issue.source} → ${issue.path}`;
    return `  - ${location}: ${issue.message}`;
}
