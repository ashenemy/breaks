import { formatLintReport, type LintMode, LintRunner, type LintRunOptions } from '../lib/lint-runner.js';

/** Разбор аргументов `lint:run`: --staged, --affected, --fix, --ci, --format-only, --files a b c. */
export function parseLintArgs(argv: readonly string[]): LintRunOptions {
    const options: LintRunOptions = {};
    const files: string[] = [];
    let collectingFiles = false;
    for (const arg of argv) {
        if (arg.startsWith('--')) {
            collectingFiles = false;
        }
        switch (arg) {
            case '--staged':
                options.mode = 'staged' satisfies LintMode;
                break;
            case '--affected':
                options.mode = 'affected';
                break;
            case '--fix':
                options.fix = true;
                break;
            case '--ci':
                options.ci = true;
                break;
            case '--format-only':
                options.formatOnly = true;
                break;
            case '--files':
                collectingFiles = true;
                break;
            default:
                if (collectingFiles || !arg.startsWith('--')) {
                    files.push(arg);
                    collectingFiles = true;
                } else {
                    throw new Error(`Неизвестный аргумент lint:run: ${arg}`);
                }
        }
    }
    if (files.length > 0) {
        options.files = files;
    }
    return options;
}

export async function main(argv: readonly string[], workspaceRoot: string): Promise<number> {
    const report = await new LintRunner({ workspaceRoot }).run(parseLintArgs(argv));
    console.log(formatLintReport(report));
    return report.success ? 0 : 1;
}
