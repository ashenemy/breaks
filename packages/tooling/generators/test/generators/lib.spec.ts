import { readJson, readProjectConfiguration, type Tree } from '@nx/devkit';
import { beforeAll, describe, expect, it } from 'vitest';

import type { LibGeneratorSchema } from '../../src/@types';
import { libGenerator } from '../../src/generators/lib/generator';
import { LIB_GENERATOR } from '../../src/lib/constants';
import { LibGenerator } from '../../src/lib/lib-generator';
import { readGeneratedProjectMetadata } from '../../src/lib/project-marker';
import { createTsSolutionTree } from '../support/ts-solution-tree';

const BASE_OPTIONS: LibGeneratorSchema = { name: 'ts-utils', type: 'core', skipFormat: true };
const ROOT = 'packages/core/ts-utils';

function read(tree: Tree, filePath: string): string {
    const content = tree.read(filePath, 'utf-8');
    if (content === null) {
        throw new Error(`Файл не создан: ${filePath}`);
    }
    return content;
}

describe('генератор lib: структура проекта', () => {
    let tree: Tree;
    let rootPackageJsonBefore = '';

    beforeAll(async () => {
        tree = createTsSolutionTree();
        rootPackageJsonBefore = read(tree, 'package.json');
        await libGenerator(tree, BASE_OPTIONS);
    });

    it.each([
        'src/@types/index.ts',
        'src/lib/ts-utils.ts',
        'src/index.ts',
        'test/ts-utils.spec.ts',
        'README.md',
        'project.json',
        'package.json',
        'tsconfig.json',
        'tsconfig.lib.json',
        'tsconfig.spec.json',
        'vitest.config.mts',
        'eslint.config.mjs',
    ])('создаёт %s', (relativePath) => {
        expect(tree.exists(`${ROOT}/${relativePath}`)).toBe(true);
    });

    it('не оставляет тестов внутри src/', () => {
        expect(tree.exists(`${ROOT}/src/lib/ts-utils.spec.ts`)).toBe(false);
    });

    it('регистрирует проект с тремя тегами и маркером генератора', () => {
        const configuration = readProjectConfiguration(tree, 'ts-utils');
        expect(configuration.root).toBe(ROOT);
        expect(configuration.projectType).toBe('library');
        expect(configuration.tags).toEqual(['scope:shared', 'type:core', 'platform:shared']);
        expect(readGeneratedProjectMetadata(tree, 'ts-utils')).toEqual({
            description: 'Пакет @market/ts-utils',
            generator: LIB_GENERATOR,
        });
    });

    it('экспортирует публичный API только именованно через src/index.ts', () => {
        const index = read(tree, `${ROOT}/src/index.ts`);
        expect(index).toContain("export type { TsUtilsInfo } from './@types/index.js';");
        expect(index).toContain("export { tsUtilsInfo } from './lib/ts-utils.js';");
        expect(index).not.toMatch(/export default|export \*/);
    });

    it('держит типы в src/@types/index.ts и реализацию в src/lib', () => {
        expect(read(tree, `${ROOT}/src/@types/index.ts`)).toContain('export type TsUtilsInfo = {');
        expect(read(tree, `${ROOT}/src/lib/ts-utils.ts`)).toContain('export function tsUtilsInfo(): TsUtilsInfo {');
    });

    it('настраивает Vitest на test/ с порогом покрытия 90%', () => {
        const vitestConfig = read(tree, `${ROOT}/vitest.config.mts`);
        expect(vitestConfig).toContain("include: ['test/**/*.spec.ts']");
        expect(vitestConfig).toContain("environment: 'node'");
        expect(vitestConfig).toMatch(/lines: 90,\s+branches: 90/);

        const tsconfigSpec = readJson<{ include: string[] }>(tree, `${ROOT}/tsconfig.spec.json`);
        expect(tsconfigSpec.include).toEqual(['vitest.config.mts', 'test/**/*.ts']);
    });

    it('тест из test/ импортирует публичный API пакета', () => {
        const spec = read(tree, `${ROOT}/test/ts-utils.spec.ts`);
        expect(spec).toContain("import { tsUtilsInfo } from '../src/index.js';");
        expect(spec).toContain("from 'vitest'");
    });

    it('пишет README с назначением, публичным API и примерами', () => {
        const readme = read(tree, `${ROOT}/README.md`);
        expect(readme).toContain('# @market/ts-utils');
        expect(readme).toContain('## Назначение');
        expect(readme).toContain('## Публичный API');
        expect(readme).toContain('## Примеры');
        expect(readme).toContain('`scope:shared`, `type:core`, `platform:shared`');
        expect(readme).toContain(LIB_GENERATOR);
    });

    it('называет пакет по import path и подключает его к TS solution', () => {
        expect(readJson<{ name: string }>(tree, `${ROOT}/package.json`).name).toBe('@market/ts-utils');
        const references = readJson<{ references: { path: string }[] }>(tree, 'tsconfig.json').references;
        expect(references).toContainEqual({ path: `./${ROOT}` });
    });

    it('пишет JSON с отступом в четыре пробела', () => {
        expect(read(tree, `${ROOT}/project.json`)).toMatch(/^\{\n {4}"/);
        expect(read(tree, 'tsconfig.json')).toMatch(/^\{\n {4}"/);
    });

    it('не трогает корневые package.json и eslint.config.mjs', () => {
        expect(read(tree, 'eslint.config.mjs')).toBe(
            "import nx from '@nx/eslint-plugin';\n\nexport default [...nx.configs['flat/base']];\n",
        );
        expect(read(tree, 'package.json')).toBe(rootPackageJsonBefore);
    });
});

describe('генератор lib: опции', () => {
    it('выводит каталог из типа и позволяет переопределить его', async () => {
        const tree = createTsSolutionTree();
        await libGenerator(tree, { name: 'tokens', type: 'ui', directory: 'packages/design/tokens', skipFormat: true });
        expect(readProjectConfiguration(tree, 'tokens').root).toBe('packages/design/tokens');
        expect(tree.exists('packages/design/tokens/src/lib/tokens.ts')).toBe(true);
    });

    it('ставит теги из type, platform и scope', async () => {
        const tree = createTsSolutionTree();
        await libGenerator(tree, {
            name: 'catalog-api',
            type: 'module',
            platform: 'api',
            scope: 'catalog',
            directory: 'modules/catalog/api',
            importPath: '@market/catalog-api',
            skipFormat: true,
        });
        expect(readProjectConfiguration(tree, 'catalog-api').tags).toEqual(['scope:catalog', 'type:module', 'platform:api']);
        expect(readJson<{ name: string }>(tree, 'modules/catalog/api/package.json').name).toBe('@market/catalog-api');
    });

    it('использует описание в README и маркере', async () => {
        const tree = createTsSolutionTree();
        await libGenerator(tree, { ...BASE_OPTIONS, description: 'Утилитарные типы TypeScript' });
        expect(tree.read(`${ROOT}/README.md`, 'utf-8')).toContain('Утилитарные типы TypeScript');
        expect(readGeneratedProjectMetadata(tree, 'ts-utils')?.description).toBe('Утилитарные типы TypeScript');
    });

    it('форматирует файлы по умолчанию и создаёт корневой конфиг ESLint, если его не было', async () => {
        const tree = createTsSolutionTree();
        tree.delete('eslint.config.mjs');
        await libGenerator(tree, { name: 'ts-utils', type: 'core' });
        expect(tree.exists('eslint.config.mjs')).toBe(true);
        expect(tree.exists(`${ROOT}/src/index.ts`)).toBe(true);
    });

    it('открывает нормализованные опции через LibGenerator.options', () => {
        const generator = new LibGenerator(createTsSolutionTree(), BASE_OPTIONS, '');
        expect(generator.options.directory).toBe(ROOT);
        expect(generator.options.tags).toEqual(['scope:shared', 'type:core', 'platform:shared']);
    });

    it.each([
        [{ name: 'TsUtils', type: 'core' }, /kebab-case/],
        [{ name: 'ts-utils', type: 'app' }, /type должно быть одним из/],
        [{ name: 'ts-utils', type: 'core', platform: 'mobile' }, /platform должно быть одним из/],
        [{ name: 'ts-utils', type: 'core', scope: 'Catalog' }, /kebab-case/],
        [{ name: 'catalog-api', type: 'module' }, /directory/],
    ] as [LibGeneratorSchema, RegExp][])('отклоняет некорректные опции %j', async (options, message) => {
        const tree = createTsSolutionTree();
        await expect(libGenerator(tree, options)).rejects.toThrow(message);
    });
});
