import { join } from 'node:path';

import { readJson } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

import { normalizeLibOptions } from '../../src/lib/normalize-lib-options';
import { applyStandardStructure } from '../../src/lib/standard-structure';
import { createTsSolutionTree } from '../support/ts-solution-tree';

const TEMPLATES_DIR = join(__dirname, '..', '..', 'src', 'generators', 'lib', 'files');

describe('applyStandardStructure', () => {
    it('создаёт структуру даже без файлов официального генератора', () => {
        const tree = createTsSolutionTree();
        const options = normalizeLibOptions({ name: 'bare', type: 'core' });
        tree.write(
            `${options.directory}/tsconfig.spec.json`,
            JSON.stringify({ compilerOptions: {}, include: ['src/**/*.spec.ts'] }),
        );

        applyStandardStructure(tree, options, TEMPLATES_DIR);

        expect(tree.exists(`${options.directory}/src/@types/index.ts`)).toBe(true);
        expect(tree.exists(`${options.directory}/src/lib/bare.ts`)).toBe(true);
        expect(tree.exists(`${options.directory}/test/bare.spec.ts`)).toBe(true);
        expect(tree.exists(`${options.directory}/README.md`)).toBe(true);
        expect(tree.exists(`${options.directory}/vitest.config.mts`)).toBe(true);
        expect(readJson<{ include: string[] }>(tree, `${options.directory}/tsconfig.spec.json`).include).toEqual([
            'vitest.config.mts',
            'test/**/*.ts',
        ]);
    });
});
