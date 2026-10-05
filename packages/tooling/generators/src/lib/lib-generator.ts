import { formatFiles, joinPathFragments, readJson, updateJson, type GeneratorCallback, type Tree } from '@nx/devkit';
import { libraryGenerator } from '@nx/js';

import type { LibGeneratorSchema, NormalizedLibOptions } from '../@types';
import { LIB_GENERATOR } from './constants';
import { listJsonFiles, reformatJsonFiles } from './json-files';
import { normalizeLibOptions } from './normalize-lib-options';
import { markGeneratedProject } from './project-marker';
import { applyStandardStructure } from './standard-structure';
import { setVitestTestTarget } from './test-target';

type NxLibraryOptions = Parameters<typeof libraryGenerator>[1];

type PackageJson = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
};

/** Корневые файлы, которые официальный генератор переписывает в своём стиле; воркспейс управляет ими сам. */
const PROTECTED_ROOT_FILES = ['eslint.config.mjs', 'package.json'];

/**
 * Генератор библиотеки воркспейса: обёртка над `@nx/js:library` (tsc, Vitest, ESLint, project.json),
 * которая затем приводит проект к структуре и правилам воркспейса.
 */
export class LibGenerator {
    private readonly __options: NormalizedLibOptions;

    private readonly __templatesDir: string;

    private readonly __tree: Tree;

    constructor(tree: Tree, options: LibGeneratorSchema, templatesDir: string) {
        this.__tree = tree;
        this.__options = normalizeLibOptions(options);
        this.__templatesDir = templatesDir;
    }

    public get options(): NormalizedLibOptions {
        return this.__options;
    }

    public async run(): Promise<GeneratorCallback> {
        const protectedFiles = this.__snapshot(PROTECTED_ROOT_FILES);
        const installTask = await libraryGenerator(this.__tree, this.__toNxLibraryOptions());
        this.__restore(protectedFiles);

        applyStandardStructure(this.__tree, this.__options, this.__templatesDir);
        markGeneratedProject(this.__tree, this.__options.projectName, {
            description: this.__options.description,
            generator: LIB_GENERATOR,
        });
        setVitestTestTarget(this.__tree, this.__options.projectName);
        this.__pinTslib();
        reformatJsonFiles(this.__tree, [
            ...listJsonFiles(this.__tree, this.__options.directory),
            'tsconfig.json',
            'nx.json',
        ]);

        if (!this.__options.skipFormat) {
            await formatFiles(this.__tree);
        }
        return installTask;
    }

    private __toNxLibraryOptions(): NxLibraryOptions {
        const { directory, importPath, projectName, tags } = this.__options;
        return {
            bundler: 'tsc',
            directory,
            formatter: 'none',
            importPath,
            linter: 'eslint',
            name: projectName,
            skipFormat: true,
            strict: true,
            tags: tags.join(','),
            testEnvironment: 'node',
            unitTestRunner: 'vitest',
            useProjectJson: true,
        };
    }

    /** Официальный генератор пишет `tslib` диапазоном; версия берётся точной из корневого package.json (ADR-0002). */
    private __pinTslib(): void {
        const rootPackageJson = readJson<PackageJson>(this.__tree, 'package.json');
        const tslibVersion = rootPackageJson.devDependencies?.['tslib'] ?? rootPackageJson.dependencies?.['tslib'];
        if (!tslibVersion) {
            return;
        }
        updateJson<PackageJson, PackageJson>(this.__tree, joinPathFragments(this.__options.directory, 'package.json'), (json) => ({
            ...json,
            dependencies: { ...json.dependencies, tslib: tslibVersion },
        }));
    }

    private __snapshot(filePaths: readonly string[]): Map<string, Buffer | null> {
        const snapshot = new Map<string, Buffer | null>();
        for (const filePath of filePaths) {
            snapshot.set(filePath, this.__tree.exists(filePath) ? this.__tree.read(filePath) : null);
        }
        return snapshot;
    }

    private __restore(snapshot: Map<string, Buffer | null>): void {
        for (const [filePath, content] of snapshot) {
            if (content === null) {
                continue;
            }
            const current = this.__tree.read(filePath);
            if (current === null || !current.equals(content)) {
                this.__tree.write(filePath, content);
            }
        }
    }
}
