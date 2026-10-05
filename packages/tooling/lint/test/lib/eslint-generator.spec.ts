import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildEslintConfig, detectToolVersions, EslintGenerator, HashCache, loadRules, PLATFORM_GLOBS } from '../../src/index.js';

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const RULES_PATH = join(WORKSPACE_ROOT, 'packages', 'tooling', 'lint', 'rules.toml');
const { config: rules } = loadRules(RULES_PATH);
const tempRoots: string[] = [];

function createTempRoot(): string {
    mkdirSync(join(WORKSPACE_ROOT, 'tmp'), { recursive: true });
    const root = mkdtempSync(join(WORKSPACE_ROOT, 'tmp', 'eslint-gen-'));
    tempRoots.push(root);
    return root;
}

afterAll(() => {
    for (const root of tempRoots) {
        rmSync(root, { recursive: true, force: true });
    }
});

describe('buildEslintConfig', () => {
    const content = buildEslintConfig(rules, { angular: false });

    it('переносит именование, порядок членов, типы и экспорты из rules.toml', () => {
        expect(content).toContain("leadingUnderscore: 'requireDouble'");
        expect(content).toContain("leadingUnderscore: 'require'");
        expect(content).toContain("'@typescript-eslint/member-ordering'");
        expect(content).toContain("'public-static-field'");
        expect(content).toMatch(/'@typescript-eslint\/consistent-type-definitions': \[\s+'error',\s+'type'/);
        expect(content).toContain("'@typescript-eslint/no-inferrable-types': 'off'");
        expect(content).toContain("'@typescript-eslint/explicit-member-accessibility'");
        expect(content).toContain("'@typescript-eslint/typedef'");
        expect(content).toContain("selector: 'ExportDefaultDeclaration'");
        expect(content).toContain("selector: 'ExportAllDeclaration'");
        expect(content).toContain('export function');
    });

    it('отключает правила, отданные Biome, и переносит границы и запрет Material', () => {
        expect(content).toContain("'@typescript-eslint/no-explicit-any': 'off'");
        expect(content).toContain("'@typescript-eslint/consistent-type-imports': 'off'");
        expect(content).toContain("sourceTag: 'platform:api'");
        expect(content).toMatch(/allSourceTags: \[\s+'scope:shared',\s+'type:core'/);
        expect(content).toContain("'@angular/material/*'");
        expect(content).toContain("'packages/ui/ui-web/**'");
    });

    it('добавляет блок платформы web с отключённым explicit-function-return-type', () => {
        expect(content).toContain("'apps/web-*/**/*.ts'");
        expect(content).toContain("'@typescript-eslint/explicit-function-return-type': 'off'");
        expect(PLATFORM_GLOBS.web).toContain('modules/*/web/**');
    });

    it('без angular-eslint не содержит Angular-блоков, с ним — шаблонные правила и i18n', () => {
        expect(content).not.toContain('angular-eslint');
        const withAngular = buildEslintConfig(rules, { angular: true });
        expect(withAngular).toContain("import angular from 'angular-eslint';");
        expect(withAngular).toContain('@angular-eslint/template/i18n');
        expect(withAngular).toContain('Element$1[name=/^(a|button|input|select|textarea)$/]');
        expect(withAngular).toContain("'**/*.html'");
    });

    it('учитывает выключенные флаги, not-on и переопределения naming/types по платформе', () => {
        const custom = {
            ...rules,
            boundaries: {
                ...rules.boundaries,
                constraints: [{ 'all-source': ['scope:shared', 'type:core'], 'not-on': ['scope:catalog'] }],
            },
            i18n: { ...rules.i18n, 'forbid-hardcoded-text': false },
            imports: { ...rules.imports, 'no-default-export': false, 'no-export-all': false },
            members: { ...rules.members, 'explicit-accessibility': false, 'explicit-return-types': false, typedef: false },
            naming: { ...rules.naming, 'exported-functions': 'const' as const },
            overlap: { biome: ['organizeImports', 'unknownRule'], eslint: [] },
            platforms: {
                api: { naming: { types: 'PascalCase' as const }, types: { 'consistent-type-definitions': 'interface' as const } },
                web: { members: { typedef: false } },
            },
        };
        const text = buildEslintConfig(custom, { angular: true });
        expect(text).toMatch(/notDependOnLibsWithTags: \[\s+'scope:catalog'/);
        expect(text).not.toContain('@angular-eslint/template/i18n');
        expect(text).not.toContain('ExportDefaultDeclaration');
        expect(text).not.toContain('export function');
        expect(text).not.toContain('explicit-member-accessibility');
        expect(text).toContain("'sort-imports': 'off'");
        expect(text).toMatch(/'apps\/api\/\*\*\/\*\.ts'[\s\S]*'interface'/);
        expect(text).not.toContain("'apps/web-*/**/*.ts'");
    });
});

describe('сгенерированный конфиг в реальном ESLint', () => {
    let root = '';
    let eslint: ESLint;

    beforeAll(() => {
        root = createTempRoot();
        const configPath = join(root, 'eslint.config.mjs');
        writeFileSync(configPath, buildEslintConfig(rules, { angular: false }));
        eslint = new ESLint({ cwd: root, overrideConfigFile: configPath });
    });

    async function ruleIds(code: string, relativePath = 'packages/core/sample/src/lib/sample.ts'): Promise<string[]> {
        const [result] = await eslint.lintText(code, { filePath: join(root, relativePath) });
        return (result?.messages ?? []).map((message) => message.ruleId ?? message.message).sort();
    }

    it.each([
        ['приватное поле без двойного подчёркивания', 'export class Store {\n    private cache: number = 1;\n}\n', '@typescript-eslint/naming-convention'],
        ['interface вместо type', 'export interface Shape {\n    size: number;\n}\n', '@typescript-eslint/consistent-type-definitions'],
        ['export default', 'const value: number = 1;\nexport default value;\n', 'no-restricted-syntax'],
        ['export * ', "export * from './other.js';\n", 'no-restricted-syntax'],
        ['export const со стрелочной функцией', 'export const run = (): number => 1;\n', 'no-restricted-syntax'],
        ['метод перед полем', 'export class Order {\n    public total(): number {\n        return 1;\n    }\n\n    public id: string = "";\n}\n', '@typescript-eslint/member-ordering'],
        ['член без модификатора доступа', 'export class Cart {\n    items: number = 0;\n}\n', '@typescript-eslint/explicit-member-accessibility'],
        ['метод без типа результата', 'export class Cart {\n    public count() {\n        return 1;\n    }\n}\n', '@typescript-eslint/explicit-function-return-type'],
        ['Angular Material вне ui-web', "import { MatButton } from '@angular/material/button';\nexport const BUTTON: unknown = MatButton;\n", 'no-restricted-imports'],
    ])('ловит: %s', async (_title, code, expected) => {
        expect(await ruleIds(code)).toContain(expected);
    });

    it('разрешает Material внутри ui-web и не дублирует правила Biome', async () => {
        const material = "import { MatButton } from '@angular/material/button';\nexport const BUTTON: unknown = MatButton;\n";
        expect(await ruleIds(material, 'packages/ui/ui-web/src/lib/button.ts')).not.toContain('no-restricted-imports');
        expect(await ruleIds('export function f(value: any): string {\n    return String(value);\n}\n')).not.toContain('@typescript-eslint/no-explicit-any');
    });

    it('пропускает код по конвенциям', async () => {
        const code = [
            'export const MAX_RETRY_COUNT: number = 3;',
            '',
            'export type OrderDto = {',
            '    id: string;',
            '};',
            '',
            'export class OrderService {',
            '    public static readonly DEFAULT_LIMIT: number = 10;',
            '',
            '    public limit: number = OrderService.DEFAULT_LIMIT;',
            '',
            '    protected _attempts: number = 0;',
            '',
            '    private __cache: Map<string, OrderDto> = new Map();',
            '',
            '    constructor(limit: number) {',
            '        this.limit = limit;',
            '    }',
            '',
            '    public getOrder(id: string): OrderDto | undefined {',
            '        return this.__cache.get(id) ?? this._load(id);',
            '    }',
            '',
            '    protected _load(id: string): OrderDto | undefined {',
            '        this._attempts += 1;',
            '        return id ? { id } : undefined;',
            '    }',
            '}',
            '',
        ].join('\n');
        expect(await ruleIds(code)).toEqual([]);
    });

    it('не трогает исключения для конфигов инструментов', async () => {
        expect(await ruleIds('export default [];\n', 'packages/core/sample/eslint.config.mjs')).toEqual([]);
    });
});

describe('EslintGenerator', () => {
    it('пишет eslint.config.mjs, учитывает хеш и версии инструментов', () => {
        const root = createTempRoot();
        const versions = { eslint: '10.12.0', '@nx/eslint-plugin': '23.2.1', 'typescript-eslint': '8.71.0' };
        const first = new EslintGenerator({ workspaceRoot: root, rulesPath: RULES_PATH }, versions).generate();
        expect(first.written).toBe(true);
        expect(readFileSync(first.filePath, 'utf8')).toBe(first.content);
        expect(first.content).not.toContain('angular-eslint');
        expect(new HashCache(root).read()['eslint']).toBe(first.hash);

        expect(new EslintGenerator({ workspaceRoot: root, rulesPath: RULES_PATH }, versions).generate().written).toBe(false);
        expect(new EslintGenerator({ workspaceRoot: root, rulesPath: RULES_PATH, force: true }, versions).generate().written).toBe(true);

        const withAngular = new EslintGenerator({ workspaceRoot: root, rulesPath: RULES_PATH }, { ...versions, 'angular-eslint': '20.0.0' }).generate();
        expect(withAngular.written).toBe(true);
        expect(withAngular.content).toContain('angular-eslint');

        const forced = new EslintGenerator({ workspaceRoot: root, rulesPath: RULES_PATH, features: { angular: false } }, { ...versions, 'angular-eslint': '20.0.0' }).generate();
        expect(forced.content).not.toContain('angular-eslint');
        expect(existsSync(first.filePath)).toBe(true);
    });

    it('определяет версии установленных инструментов', () => {
        const versions = detectToolVersions(WORKSPACE_ROOT);
        expect(Object.keys(versions).sort()).toEqual(['@nx/eslint-plugin', 'eslint', 'typescript-eslint']);
        expect(versions['eslint']).toMatch(/^\d+\.\d+\.\d+$/);
    });
});
