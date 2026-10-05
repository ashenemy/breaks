import type { VitestExecutorSchema } from '../@types';

/**
 * Переводит опции executor-а (в том числе флаги в стиле Jest из приёмочных команд эпиков)
 * в аргументы командной строки Vitest. `testPathPattern` становится позиционным фильтром файлов.
 */
export function buildVitestArgs(options: VitestExecutorSchema): string[] {
    const args: string[] = [options.watch ? 'watch' : 'run'];

    for (const pattern of toArray(options.testPathPattern)) {
        args.push(pattern);
    }
    if (options.testNamePattern) {
        args.push('--testNamePattern', options.testNamePattern);
    }
    if (options.coverage) {
        args.push('--coverage');
    }
    if (options.update) {
        args.push('--update');
    }
    if (options.passWithNoTests) {
        args.push('--passWithNoTests');
    }
    if (options.bail !== undefined && options.bail > 0) {
        args.push('--bail', String(options.bail));
    }
    for (const reporter of options.reporters ?? []) {
        args.push('--reporter', reporter);
    }
    if (options.configFile) {
        args.push('--config', options.configFile);
    }
    return args;
}

function toArray(value: string | string[] | undefined): string[] {
    if (value === undefined) {
        return [];
    }
    return (Array.isArray(value) ? value : [value]).map((item) => item.trim()).filter((item) => item.length > 0);
}
