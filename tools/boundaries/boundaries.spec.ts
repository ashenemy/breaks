import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { detectToolVersions, EslintGenerator } from '../../packages/tooling/lint/src/index.js';

/**
 * Приёмочный тест E00.01.02: правило `@nx/enforce-module-boundaries` с ограничениями из
 * `[boundaries]` в `packages/tooling/lint/rules.toml` ловит запрещённые импорты и пропускает разрешённые.
 *
 * Правило работает по кэшу графа проектов, поэтому проверка идёт во временном воркспейсе
 * внутри `tmp/` (в `.gitignore`; пакеты разрешаются из корневого `node_modules` подъёмом по
 * дереву). Туда генерируется `eslint.config.mjs` из реального `rules.toml`, создаются
 * проекты-фикстуры с тегами и файлы с импортами, строится граф (`nx graph`) и запускается ESLint.
 */

type FixtureProject = {
    name: string;
    projectType: 'application' | 'library';
    root: string;
    tags: string[];
};

type BoundaryCase = {
    /** Идентификатор кейса: имя файла с импортом внутри проекта-источника. */
    id: string;
    title: string;
    source: string;
    target: string;
    /** Ожидаемый фрагмент сообщения; отсутствие означает разрешённый импорт. */
    expectedMessage?: string;
};

type LintMessage = {
    message: string;
    ruleId: string | null;
    severity: number;
};

type LintResult = {
    filePath: string;
    messages: LintMessage[];
};

type ProcessOutput = {
    status: number | null;
    stderr: string;
    stdout: string;
};

const RULE_ID = '@nx/enforce-module-boundaries';
const IMPORT_SCOPE = '@fixture';
const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RULES_PATH = join(WORKSPACE_ROOT, 'packages', 'tooling', 'lint', 'rules.toml');

const PROJECTS: FixtureProject[] = [
    { name: 'api', projectType: 'application', root: 'apps/api', tags: ['scope:shared', 'type:app', 'platform:api'] },
    {
        name: 'catalog-api',
        projectType: 'library',
        root: 'modules/catalog/api',
        tags: ['scope:catalog', 'type:module', 'platform:api'],
    },
    {
        name: 'catalog-web',
        projectType: 'library',
        root: 'modules/catalog/web',
        tags: ['scope:catalog', 'type:module', 'platform:web'],
    },
    {
        name: 'catalog-native',
        projectType: 'library',
        root: 'modules/catalog/native',
        tags: ['scope:catalog', 'type:module', 'platform:native'],
    },
    {
        name: 'orders-api',
        projectType: 'library',
        root: 'modules/orders/api',
        tags: ['scope:orders', 'type:module', 'platform:api'],
    },
    {
        name: 'auth-api',
        projectType: 'library',
        root: 'modules/auth/api',
        tags: ['scope:shared', 'type:module', 'platform:api'],
    },
    {
        name: 'ts-utils',
        projectType: 'library',
        root: 'packages/core/ts-utils',
        tags: ['scope:shared', 'type:core', 'platform:shared'],
    },
    {
        name: 'js-utils',
        projectType: 'library',
        root: 'packages/core/js-utils',
        tags: ['scope:shared', 'type:core', 'platform:shared'],
    },
    {
        name: 'contracts-catalog',
        projectType: 'library',
        root: 'packages/contracts/catalog',
        tags: ['scope:catalog', 'type:contracts', 'platform:shared'],
    },
    {
        name: 'ui-web',
        projectType: 'library',
        root: 'packages/ui/ui-web',
        tags: ['scope:shared', 'type:ui', 'platform:web'],
    },
    {
        name: 'infra-mongo',
        projectType: 'library',
        root: 'packages/infra/mongo',
        tags: ['scope:shared', 'type:infra', 'platform:api'],
    },
    {
        name: 'infra-redis',
        projectType: 'library',
        root: 'packages/infra/redis',
        tags: ['scope:shared', 'type:infra', 'platform:api'],
    },
    {
        name: 'tooling-progress',
        projectType: 'library',
        root: 'packages/tooling/progress',
        tags: ['scope:shared', 'type:tooling', 'platform:api'],
    },
    { name: 'untagged', projectType: 'library', root: 'packages/untagged', tags: [] },
];

/** Граф импортов всех кейсов ацикличен: иначе правило сообщит о цикле вместо нарушения тегов. */
const VIOLATIONS: BoundaryCase[] = [
    {
        id: 'web-module-imports-api-app',
        title: 'импорт apps/api из modules/catalog/web (приложение)',
        source: 'catalog-web',
        target: 'api',
        expectedMessage: 'Imports of apps are forbidden',
    },
    {
        id: 'web-imports-api',
        title: 'platform:web → platform:api',
        source: 'catalog-web',
        target: 'catalog-api',
        expectedMessage:
            'A project tagged with "platform:web" can only depend on libs tagged with "platform:web", "platform:shared"',
    },
    {
        id: 'native-imports-web',
        title: 'platform:native → platform:web',
        source: 'catalog-native',
        target: 'catalog-web',
        expectedMessage:
            'A project tagged with "platform:native" can only depend on libs tagged with "platform:native", "platform:shared"',
    },
    {
        id: 'shared-platform-imports-api',
        title: 'platform:shared → platform:api',
        source: 'contracts-catalog',
        target: 'infra-mongo',
        expectedMessage:
            'A project tagged with "platform:shared" can only depend on libs tagged with "platform:shared"',
    },
    {
        id: 'app-imports-tooling',
        title: 'type:app → type:tooling',
        source: 'api',
        target: 'tooling-progress',
        expectedMessage:
            'A project tagged with "type:app" can only depend on libs tagged with "type:module", "type:ui", "type:infra", "type:contracts", "type:core"',
    },
    {
        id: 'core-imports-contracts',
        title: 'type:core → type:contracts',
        source: 'ts-utils',
        target: 'contracts-catalog',
        expectedMessage: 'A project tagged with "type:core" can only depend on libs tagged with "type:core"',
    },
    {
        id: 'infra-imports-module',
        title: 'type:infra → type:module',
        source: 'infra-redis',
        target: 'catalog-api',
        expectedMessage:
            'A project tagged with "type:infra" can only depend on libs tagged with "type:infra", "type:contracts", "type:core"',
    },
    {
        id: 'shared-scope-imports-domain',
        title: 'scope:shared (ui) → scope:catalog',
        source: 'ui-web',
        target: 'contracts-catalog',
        expectedMessage:
            'A project tagged with "scope:shared" and "type:ui" can only depend on libs tagged with "scope:shared"',
    },
    {
        id: 'shared-module-imports-domain',
        title: 'scope:shared (module) → scope:catalog',
        source: 'auth-api',
        target: 'catalog-api',
        expectedMessage:
            'A project tagged with "scope:shared" and "type:module" can only depend on libs tagged with "scope:shared"',
    },
    {
        id: 'imports-untagged',
        title: 'зависимость от проекта без тегов',
        source: 'api',
        target: 'untagged',
        expectedMessage:
            'A project tagged with "platform:api" can only depend on libs tagged with "platform:api", "platform:shared"',
    },
    {
        id: 'untagged-imports',
        title: 'импорт из проекта без тегов',
        source: 'untagged',
        target: 'js-utils',
        expectedMessage: 'A project without tags matching at least one constraint cannot depend on any libraries',
    },
];

const ALLOWED: BoundaryCase[] = [
    { id: 'web-module-imports-ui', title: 'module/web → ui/web', source: 'catalog-web', target: 'ui-web' },
    {
        id: 'web-module-imports-contracts',
        title: 'module/web → contracts',
        source: 'catalog-web',
        target: 'contracts-catalog',
    },
    { id: 'web-module-imports-core', title: 'module/web → core', source: 'catalog-web', target: 'ts-utils' },
    {
        id: 'native-module-imports-contracts',
        title: 'module/native → contracts',
        source: 'catalog-native',
        target: 'contracts-catalog',
    },
    {
        id: 'app-imports-module',
        title: 'app/api (scope:shared) → module/catalog',
        source: 'api',
        target: 'catalog-api',
    },
    { id: 'app-imports-infra', title: 'app/api → infra/api', source: 'api', target: 'infra-mongo' },
    { id: 'app-imports-core', title: 'app/api → core', source: 'api', target: 'ts-utils' },
    {
        id: 'module-imports-other-domain',
        title: 'module/orders → module/catalog (между доменами)',
        source: 'orders-api',
        target: 'catalog-api',
    },
    { id: 'module-imports-infra', title: 'module/api → infra/api', source: 'catalog-api', target: 'infra-mongo' },
    {
        id: 'module-imports-contracts',
        title: 'module/api → contracts',
        source: 'catalog-api',
        target: 'contracts-catalog',
    },
    { id: 'infra-imports-core', title: 'infra → core', source: 'infra-mongo', target: 'js-utils' },
    { id: 'contracts-imports-core', title: 'contracts → core', source: 'contracts-catalog', target: 'js-utils' },
    { id: 'ui-imports-core', title: 'ui → core', source: 'ui-web', target: 'js-utils' },
    { id: 'tooling-imports-core', title: 'tooling → core', source: 'tooling-progress', target: 'ts-utils' },
    {
        id: 'tooling-imports-module',
        title: 'tooling (scope:shared) → module/catalog',
        source: 'tooling-progress',
        target: 'catalog-api',
    },
];

const CASES: BoundaryCase[] = [...VIOLATIONS, ...ALLOWED];

function findProject(name: string): FixtureProject {
    const project = PROJECTS.find((candidate) => candidate.name === name);
    if (!project) {
        throw new Error(`Неизвестный проект-фикстура: ${name}`);
    }
    return project;
}

function caseFilePath(boundaryCase: BoundaryCase): string {
    return `${findProject(boundaryCase.source).root}/src/lib/${boundaryCase.id}.ts`;
}

function writeJson(filePath: string, value: unknown): void {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(value, null, 4)}\n`);
}

function writeText(filePath: string, content: string): void {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content);
}

function createFixtureWorkspace(): string {
    const tmpDir = join(WORKSPACE_ROOT, 'tmp');
    mkdirSync(tmpDir, { recursive: true });
    const root = mkdtempSync(join(tmpDir, 'boundaries-'));

    new EslintGenerator({ workspaceRoot: root, rulesPath: RULES_PATH }, detectToolVersions(WORKSPACE_ROOT)).generate();

    writeJson(join(root, 'package.json'), { name: 'boundaries-fixture', private: true });
    writeJson(join(root, 'nx.json'), { useDaemonProcess: false, plugins: [] });

    const paths: Record<string, string[]> = {};
    for (const project of PROJECTS) {
        paths[`${IMPORT_SCOPE}/${project.name}`] = [`${project.root}/src/index.ts`];
        writeJson(join(root, project.root, 'project.json'), {
            name: project.name,
            projectType: project.projectType,
            sourceRoot: `${project.root}/src`,
            tags: project.tags,
        });
        writeText(join(root, project.root, 'src', 'index.ts'), `export const TOKEN = '${project.name}';\n`);
    }
    writeJson(join(root, 'tsconfig.base.json'), { compilerOptions: { baseUrl: '.', paths } });

    for (const boundaryCase of CASES) {
        writeText(
            join(root, caseFilePath(boundaryCase)),
            `import { TOKEN } from '${IMPORT_SCOPE}/${boundaryCase.target}';\n\nexport const USED = TOKEN;\n`,
        );
    }

    return root;
}

function removeFixtureWorkspace(root: string): void {
    rmSync(root, { recursive: true, force: true });
}

function runNode(root: string, script: string, args: string[], allowedStatuses: number[]): ProcessOutput {
    const result = spawnSync(process.execPath, [join(WORKSPACE_ROOT, 'node_modules', script), ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, CI: 'true', NX_DAEMON: 'false', NX_WORKSPACE_ROOT_PATH: root },
        maxBuffer: 64 * 1024 * 1024,
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status === null || !allowedStatuses.includes(result.status)) {
        throw new Error(
            `${script} ${args.join(' ')} завершился с кодом ${result.status}\n${result.stdout}\n${result.stderr}`,
        );
    }
    return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

function warmProjectGraph(root: string): string[] {
    const output = runNode(root, 'nx/dist/bin/nx.js', ['graph', '--file=graph.json'], [0]);
    let graph: unknown;
    try {
        graph = JSON.parse(readFileSync(join(root, 'graph.json'), 'utf8'));
    } catch (error) {
        throw new Error(`nx graph не записал graph.json\n${output.stdout}\n${output.stderr}`, { cause: error });
    }
    const nodes = (graph as { graph: { nodes: Record<string, unknown> } }).graph.nodes;
    return Object.keys(nodes);
}

function lintCases(root: string): Map<string, LintMessage[]> {
    const files = CASES.map(caseFilePath);
    // Код 1 означает найденные ошибки линтинга, то есть ожидаемый результат для нарушений.
    const { stdout, stderr } = runNode(
        root,
        'eslint/bin/eslint.js',
        ['--format', 'json', '--no-warn-ignored', ...files],
        [0, 1],
    );

    let results: unknown;
    try {
        results = JSON.parse(stdout);
    } catch (error) {
        throw new Error(`ESLint вернул не JSON:\n${stdout}\n${stderr}`, { cause: error });
    }
    if (!Array.isArray(results)) {
        throw new Error(`ESLint вернул неожиданный результат:\n${stdout}\n${stderr}`);
    }

    const byCase = new Map<string, LintMessage[]>();
    for (const result of results as LintResult[]) {
        const normalizedPath = result.filePath.replace(/\\/g, '/');
        const boundaryCase = CASES.find((candidate) => normalizedPath.endsWith(`/${caseFilePath(candidate)}`));
        if (boundaryCase) {
            byCase.set(
                boundaryCase.id,
                result.messages.filter((message) => message.ruleId === RULE_ID),
            );
        }
    }
    return byCase;
}

describe('границы модулей: @nx/enforce-module-boundaries с tools/boundaries/dep-constraints.mjs', () => {
    let workspace = '';
    let projectNames: string[] = [];
    let messagesByCase = new Map<string, LintMessage[]>();

    beforeAll(() => {
        workspace = createFixtureWorkspace();
        projectNames = warmProjectGraph(workspace);
        messagesByCase = lintCases(workspace);
    });

    afterAll(() => {
        if (workspace) {
            removeFixtureWorkspace(workspace);
        }
    });

    it('граф временного воркспейса содержит все проекты-фикстуры', () => {
        expect(projectNames).toEqual(expect.arrayContaining(PROJECTS.map((project) => project.name)));
    });

    it('каждый кейс попал в отчёт ESLint', () => {
        expect([...messagesByCase.keys()].sort()).toEqual(CASES.map((boundaryCase) => boundaryCase.id).sort());
    });

    it.each(VIOLATIONS)('запрещает: $title', ({ id, expectedMessage }) => {
        const messages = (messagesByCase.get(id) ?? []).map((message) => message.message);
        expect(messages).toContainEqual(expect.stringContaining(expectedMessage ?? ''));
    });

    it.each(ALLOWED)('разрешает: $title', ({ id }) => {
        expect((messagesByCase.get(id) ?? []).map((message) => message.message)).toEqual([]);
    });
});
