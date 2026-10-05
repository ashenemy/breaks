import type { FormatRules, RulesConfig } from '../@types/index.js';

/** Фрагмент `biome.json`, который генерируется из `rules.toml`. */
export type BiomeConfig = {
    $schema: string;
    assist: { actions: { source: { organizeImports: 'on' | 'off' } } };
    files: { includes: string[] };
    formatter: {
        enabled: true;
        indentStyle: 'space';
        indentWidth: number;
        lineEnding: 'lf';
        lineWidth: number;
    };
    javascript: {
        formatter: { quoteStyle: 'single' | 'double'; trailingCommas: 'all' | 'es5' | 'none' };
        parser: { unsafeParameterDecoratorsEnabled: boolean };
    };
    json: { formatter: { indentWidth: number } };
    linter: { enabled: true; rules: Record<string, Record<string, 'error' | 'warn' | 'off'>> };
    vcs: { clientKind: 'git'; enabled: false; useIgnoreFile: false };
};

/** Правила Biome, которыми `[overlap].biome` может быть включён, и их группы. */
const BIOME_RULE_GROUPS: Record<string, string> = {
    noExplicitAny: 'suspicious',
    noUnusedImports: 'correctness',
    noUnusedVariables: 'correctness',
    useExportType: 'style',
    useImportType: 'style',
};

/** Каталоги вне линтинга и форматирования. */
const EXCLUDED = [
    '!**/dist',
    '!**/out-tsc',
    '!**/coverage',
    '!**/test-output',
    '!**/.nx',
    '!**/node_modules',
    '!tmp',
    '!eslint.config.mjs',
    '!**/*.template',
];

export function biomeSchemaUrl(version: string): string {
    return `https://biomejs.dev/schemas/${version}/schema.json`;
}

/** Строит `biome.json` из правил: форматирование из `[format]`, правила из `[overlap].biome`. */
export function buildBiomeConfig(rules: RulesConfig, biomeVersion: string): BiomeConfig {
    const format: FormatRules = rules.format;
    const severity = rules.types['no-explicit-any'];
    const linterRules: Record<string, Record<string, 'error' | 'warn' | 'off'>> = {};
    let organizeImports: 'on' | 'off' = 'off';

    for (const rule of rules.overlap.biome) {
        if (rule === 'organizeImports') {
            organizeImports = rules.imports.sort ? 'on' : 'off';
            continue;
        }
        const group = BIOME_RULE_GROUPS[rule];
        if (!group) {
            throw new Error(`Неизвестное правило Biome в [overlap].biome: ${rule}`);
        }
        linterRules[group] = { ...linterRules[group], [rule]: rule === 'noExplicitAny' ? severity : 'error' };
    }

    return {
        $schema: biomeSchemaUrl(biomeVersion),
        assist: { actions: { source: { organizeImports } } },
        files: { includes: ['**', ...EXCLUDED] },
        formatter: {
            enabled: true,
            indentStyle: 'space',
            indentWidth: format.indent,
            lineEnding: format['line-ending'],
            lineWidth: format['line-width'],
        },
        javascript: {
            formatter: { quoteStyle: format.quotes, trailingCommas: format['trailing-commas'] },
            // Декораторы параметров (`constructor(@Inject(TOKEN) dep)`) Biome по умолчанию считает ошибкой разбора.
            parser: { unsafeParameterDecoratorsEnabled: format['parameter-decorators'] },
        },
        json: { formatter: { indentWidth: format.indent } },
        linter: { enabled: true, rules: linterRules },
        // Файлы отбирает раннер через git; интеграция Biome с VCS выключена, чтобы .gitignore не скрывал явно переданные файлы.
        vcs: { clientKind: 'git', enabled: false, useIgnoreFile: false },
    };
}
