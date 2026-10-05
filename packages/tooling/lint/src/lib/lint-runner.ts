import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';

import { BiomeGenerator } from './biome-generator.js';
import { EslintGenerator } from './eslint-generator.js';
import { DEFAULT_RULES_PATH } from './rules-loader.js';

export type LintMode = 'all' | 'affected' | 'staged';

export type LintRunOptions = {
    /** Предупреждения считаются ошибками, кэш чистых файлов не используется. */
    ci?: boolean;
    files?: string[];
    fix?: boolean;
    formatOnly?: boolean;
    mode?: LintMode;
    rulesPath?: string;
};

export type Diagnostic = {
    file: string;
    line?: number;
    message: string;
    rule: string;
    severity: 'error' | 'warning';
    tool: 'biome' | 'eslint';
};

export type LintReport = {
    cachedFiles: number;
    configsRegenerated: string[];
    diagnostics: Diagnostic[];
    errors: number;
    files: number;
    mode: LintMode;
    success: boolean;
    warnings: number;
};

export type ProcessResult = { status: number; stderr: string; stdout: string };

/** Запуск дочерних процессов (git, biome); подменяется в тестах. */
export type ProcessExecutor = (command: string, args: string[], cwd: string) => ProcessResult;

export type EslintFileResult = {
    filePath: string;
    messages: { line?: number; message: string; ruleId: string | null; severity: number }[];
    output?: string;
};

/** Обёртка над ESLint Node API; подменяется в тестах. */
export type EslintEngine = {
    lintFiles(files: string[]): Promise<EslintFileResult[]>;
    outputFixes(results: EslintFileResult[]): Promise<void>;
};

export type EslintEngineFactory = (options: { cwd: string; fix: boolean }) => Promise<EslintEngine>;

export type LintRunnerDependencies = {
    createEslint?: EslintEngineFactory;
    exec?: ProcessExecutor;
    /** Выключает перегенерацию конфигов (тесты с заранее подготовленными файлами). */
    skipConfigs?: boolean;
    workspaceRoot: string;
};

const LINTABLE = /\.(c|m)?[jt]sx?$|\.json$/;
const CLEAN_CACHE_RELATIVE = join('.cache', 'lint', 'clean.json');
export const REPORT_RELATIVE = join('.cache', 'lint', 'report.json');

type BiomeJsonDiagnostic = {
    category?: string;
    description?: string;
    location?: { path?: string | { file?: string }; start?: { line?: number } };
    message?: string;
    severity?: string;
};

/** Раннер линтинга: конфиги из TOML → Biome (формат и быстрые правила) → ESLint → единый отчёт. */
export class LintRunner {
    private readonly __createEslint: EslintEngineFactory;

    private readonly __exec: ProcessExecutor;

    private readonly __root: string;

    private readonly __skipConfigs: boolean;

    constructor(dependencies: LintRunnerDependencies) {
        this.__root = resolve(dependencies.workspaceRoot);
        this.__exec = dependencies.exec ?? defaultExec;
        this.__createEslint = dependencies.createEslint ?? defaultEslintFactory;
        this.__skipConfigs = dependencies.skipConfigs ?? false;
    }

    public async run(options: LintRunOptions = {}): Promise<LintReport> {
        const mode: LintMode = options.mode ?? (options.files ? 'all' : 'all');
        const ci = options.ci ?? false;
        const fix = (options.fix ?? false) && !ci;
        const configsRegenerated = this.__skipConfigs ? [] : this.__ensureConfigs(options.rulesPath);

        const allFiles = this.collectFiles(mode, options.files);
        const cleanCache = ci ? {} : this.__readCleanCache();
        const configStamp = this.__configStamp();
        const files = allFiles.filter((file) => cleanCache[file] !== this.__fileStamp(file, configStamp));
        const cachedFiles = allFiles.length - files.length;

        const diagnostics: Diagnostic[] = [];
        if (files.length > 0) {
            diagnostics.push(...this.__runBiome(files, { fix, formatOnly: options.formatOnly ?? false }));
            if (!options.formatOnly) {
                diagnostics.push(...(await this.__runEslint(files, fix)));
            }
        }

        const errors = diagnostics.filter((item) => item.severity === 'error').length;
        const warnings = diagnostics.length - errors;
        const success = errors === 0 && (!ci || warnings === 0);
        if (!ci) {
            this.__writeCleanCache(cleanCache, files, diagnostics, configStamp);
        }
        const report: LintReport = {
            cachedFiles,
            configsRegenerated,
            diagnostics,
            errors,
            files: allFiles.length,
            mode,
            success,
            warnings,
        };
        this.__writeReport(report);
        return report;
    }

    /** Файлы по режиму: staged (индекс git), affected (относительно main и рабочее дерево), all или явный список. */
    public collectFiles(mode: LintMode, explicit?: string[]): string[] {
        let candidates: string[];
        if (explicit && explicit.length > 0) {
            candidates = explicit;
        } else if (mode === 'staged') {
            candidates = this.__git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
        } else if (mode === 'affected') {
            candidates = [
                ...this.__git(['diff', '--name-only', '--diff-filter=ACMR', '--merge-base', 'main', 'HEAD']),
                ...this.__git(['diff', '--name-only', '--diff-filter=ACMR']),
                ...this.__git(['ls-files', '--others', '--exclude-standard']),
            ];
        } else {
            candidates = this.__git(['ls-files', '--cached', '--others', '--exclude-standard']);
        }
        const unique = new Set(
            candidates
                .map((file) => file.trim().replace(/\\/g, '/'))
                .filter(
                    (file) =>
                        file.length > 0 && LINTABLE.test(file) && !file.includes('/dist/') && !file.startsWith('tmp/'),
                )
                .filter((file) => existsSync(join(this.__root, file))),
        );
        return [...unique].sort();
    }

    private __ensureConfigs(rulesPath: string = DEFAULT_RULES_PATH): string[] {
        const regenerated: string[] = [];
        const biome = new BiomeGenerator({ workspaceRoot: this.__root, rulesPath }).generate();
        if (biome.written) {
            regenerated.push('biome.json');
        }
        const eslint = new EslintGenerator({ workspaceRoot: this.__root, rulesPath }).generate();
        if (eslint.written) {
            regenerated.push('eslint.config.mjs');
        }
        return regenerated;
    }

    private __git(args: string[]): string[] {
        const result = this.__exec('git', args, this.__root);
        if (result.status !== 0) {
            throw new Error(`git ${args.join(' ')} завершился с кодом ${result.status}: ${result.stderr}`);
        }
        return result.stdout.split('\n');
    }

    private __runBiome(files: string[], options: { fix: boolean; formatOnly: boolean }): Diagnostic[] {
        const biomeBin = join(
            dirname(createRequire(import.meta.url).resolve('@biomejs/biome/package.json')),
            'bin',
            'biome',
        );
        const args = [biomeBin, 'check', '--reporter=json', '--no-errors-on-unmatched', '--files-ignore-unknown=true'];
        if (options.fix) {
            args.push('--write');
        }
        if (options.formatOnly) {
            args.push('--linter-enabled=false', '--assist-enabled=false');
        }
        const result = this.__exec(process.execPath, [...args, ...files], this.__root);
        return parseBiomeReport(result.stdout, this.__root);
    }

    private async __runEslint(files: string[], fix: boolean): Promise<Diagnostic[]> {
        const eslintFiles = files.filter((file) => !file.endsWith('.json'));
        if (eslintFiles.length === 0) {
            return [];
        }
        const engine = await this.__createEslint({ cwd: this.__root, fix });
        const results = await engine.lintFiles(eslintFiles.map((file) => join(this.__root, file)));
        if (fix) {
            await engine.outputFixes(results);
        }
        return results.flatMap((result) =>
            result.messages.map((message) => ({
                file: relative(this.__root, result.filePath).replace(/\\/g, '/'),
                line: message.line,
                message: message.message,
                rule: message.ruleId ?? 'eslint',
                severity: message.severity === 2 ? 'error' : 'warning',
                tool: 'eslint' as const,
            })),
        );
    }

    private __configStamp(): string {
        const hash = createHash('sha256');
        for (const name of ['biome.json', 'eslint.config.mjs']) {
            const filePath = join(this.__root, name);
            hash.update(existsSync(filePath) ? readFileSync(filePath) : '');
        }
        return hash.digest('hex');
    }

    private __fileStamp(file: string, configStamp: string): string {
        return createHash('sha256')
            .update(readFileSync(join(this.__root, file)))
            .update(configStamp)
            .digest('hex');
    }

    private __readCleanCache(): Record<string, string> {
        const filePath = join(this.__root, CLEAN_CACHE_RELATIVE);
        if (!existsSync(filePath)) {
            return {};
        }
        try {
            const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
            return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, string>) : {};
        } catch {
            return {};
        }
    }

    private __writeCleanCache(
        cache: Record<string, string>,
        files: string[],
        diagnostics: Diagnostic[],
        configStamp: string,
    ): void {
        const dirty = new Set(diagnostics.map((item) => item.file));
        const next: Record<string, string> = { ...cache };
        for (const file of files) {
            if (dirty.has(file)) {
                delete next[file];
            } else {
                next[file] = this.__fileStamp(file, configStamp);
            }
        }
        writeAtomic(join(this.__root, CLEAN_CACHE_RELATIVE), JSON.stringify(next, null, 4));
    }

    private __writeReport(report: LintReport): void {
        writeAtomic(join(this.__root, REPORT_RELATIVE), JSON.stringify(report, null, 4));
    }
}

/** Разбор JSON-репортера Biome (2.x: `message`, `location.path`, `location.start.line`) в единый формат. */
export function parseBiomeReport(stdout: string, workspaceRoot: string): Diagnostic[] {
    const start = stdout.indexOf('{');
    const end = stdout.lastIndexOf('}');
    if (start < 0 || end < start) {
        return [];
    }
    let parsed: { diagnostics?: BiomeJsonDiagnostic[] };
    try {
        parsed = JSON.parse(stdout.slice(start, end + 1)) as { diagnostics?: BiomeJsonDiagnostic[] };
    } catch {
        return [];
    }
    return (parsed.diagnostics ?? [])
        .filter((item) => item.severity === 'error' || item.severity === 'warning' || item.severity === 'fatal')
        .map((item) => {
            const path =
                typeof item.location?.path === 'string' ? item.location.path : (item.location?.path?.file ?? '');
            const line = item.location?.start?.line;
            return {
                file: normalizeFile(path, workspaceRoot),
                ...(line ? { line } : {}),
                message: (item.message ?? item.description ?? '').split('\n')[0] ?? '',
                rule: item.category ?? 'biome',
                severity: item.severity === 'warning' ? 'warning' : 'error',
                tool: 'biome' as const,
            };
        });
}

/** Текстовый отчёт для терминала и CI. */
export function formatLintReport(report: LintReport): string {
    const lines = report.diagnostics.map(
        (item) =>
            `${item.severity === 'error' ? 'ошибка' : 'предупреждение'}  ${item.file}${item.line ? `:${item.line}` : ''}  ${item.rule}  ${item.message}`,
    );
    const summary =
        `Файлов: ${report.files} (из кэша: ${report.cachedFiles}), ошибок: ${report.errors}, предупреждений: ${report.warnings}` +
        (report.configsRegenerated.length > 0 ? `, перегенерированы: ${report.configsRegenerated.join(', ')}` : '');
    return [...lines, summary, report.success ? 'Линтинг пройден.' : 'Линтинг не пройден.'].join('\n');
}

function normalizeFile(file: string, workspaceRoot: string): string {
    const normalized = file.replace(/\\/g, '/');
    const root = workspaceRoot.replace(/\\/g, '/');
    return normalized.startsWith(root) ? normalized.slice(root.length).replace(/^\//, '') : normalized;
}

function writeAtomic(filePath: string, content: string): void {
    mkdirSync(dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.tmp`;
    writeFileSync(tempPath, `${content}\n`);
    renameSync(tempPath, filePath);
}

function defaultExec(command: string, args: string[], cwd: string): ProcessResult {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return { status: result.status ?? 1, stderr: result.stderr ?? '', stdout: result.stdout ?? '' };
}

async function defaultEslintFactory(options: { cwd: string; fix: boolean }): Promise<EslintEngine> {
    const { ESLint: eslintClass } = await import('eslint');
    const eslint = new eslintClass({ cwd: options.cwd, fix: options.fix });
    return {
        lintFiles: (files) => eslint.lintFiles(files),
        outputFixes: (results) => eslintClass.outputFixes(results as Parameters<typeof eslintClass.outputFixes>[0]),
    };
}
