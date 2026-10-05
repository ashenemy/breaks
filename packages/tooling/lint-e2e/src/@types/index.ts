/** Фикстура нарушения: файл относительно корня временного воркспейса и ожидаемые правила в отчёте. */
export type ViolationFixture = {
    content: string;
    /** Правила (идентификаторы Biome `lint/...`/`format` или ESLint), которые должны сработать. */
    expectedRules: string[];
    file: string;
    name: string;
    /** Пункт `docs/epics/E00.02-lint-tooling.md`, который фикстура покрывает. */
    rule: string;
};

/** Диагностика из `.cache/lint/report.json` раннера. */
export type ReportDiagnostic = {
    file: string;
    line?: number;
    message: string;
    rule: string;
    severity: 'error' | 'warning';
    tool: 'biome' | 'eslint';
};

export type RunnerReport = {
    cachedFiles: number;
    configsRegenerated: string[];
    diagnostics: ReportDiagnostic[];
    errors: number;
    files: number;
    success: boolean;
    warnings: number;
};

export type CliRun = {
    report: RunnerReport;
    status: number;
    stdout: string;
};
