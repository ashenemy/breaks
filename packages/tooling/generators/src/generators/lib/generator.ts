import { join } from 'node:path';

import type { GeneratorCallback, Tree } from '@nx/devkit';

import type { LibGeneratorSchema } from '../../@types';
import { LibGenerator } from '../../lib/lib-generator';

/** Точка входа `nx g @market/tooling:lib`. */
export async function libGenerator(tree: Tree, options: LibGeneratorSchema): Promise<GeneratorCallback> {
    return new LibGenerator(tree, options, join(__dirname, 'files')).run();
}
