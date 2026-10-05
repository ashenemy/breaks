import { updateJson, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

type PackageJson = {
    workspaces?: string[];
};

type TsConfig = {
    compilerOptions?: Record<string, unknown>;
};

type NxJson = {
    plugins?: unknown[];
};

/**
 * Виртуальное дерево, повторяющее реальный воркспейс: TS solution (project references),
 * workspaces пакетного менеджера, плагины инференса Nx и корневой конфиг ESLint.
 */
export function createTsSolutionTree(): Tree {
    const tree = createTreeWithEmptyWorkspace();

    // Воркспейс форматирует Biome (E00.02): без этого файла вложенные init-генераторы Nx скачивают oxfmt.
    tree.delete('.oxfmtrc.json');

    updateJson<PackageJson, PackageJson>(tree, 'package.json', (json) => ({
        ...json,
        workspaces: ['apps/*', 'packages/*/*', 'modules/*/*'],
    }));
    // Nx определяет пакетный менеджер по реальному корню (pnpm), поэтому нужен и pnpm-workspace.yaml.
    tree.write('pnpm-workspace.yaml', 'packages:\n  - "apps/*"\n  - "packages/*/*"\n  - "modules/*/*"\n');

    updateJson<TsConfig, TsConfig>(tree, 'tsconfig.base.json', (json) => {
        const compilerOptions = { ...json.compilerOptions };
        delete compilerOptions['paths'];
        return {
            ...json,
            compilerOptions: { ...compilerOptions, composite: true, declaration: true, strict: true },
        };
    });
    writeJson(tree, 'tsconfig.json', { extends: './tsconfig.base.json', files: [], references: [] });

    updateJson<NxJson, NxJson>(tree, 'nx.json', (json) => ({
        ...json,
        plugins: [
            {
                plugin: '@nx/js/typescript',
                options: {
                    typecheck: { targetName: 'typecheck' },
                    build: { targetName: 'build', configName: 'tsconfig.lib.json' },
                },
            },
            { plugin: '@nx/eslint/plugin', options: { targetName: 'lint' } },
            { plugin: '@nx/vitest', options: { testTargetName: 'test' } },
        ],
    }));

    tree.write('eslint.config.mjs', "import nx from '@nx/eslint-plugin';\n\nexport default [...nx.configs['flat/base']];\n");

    return tree;
}
