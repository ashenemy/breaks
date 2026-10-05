import { names } from '@nx/devkit';

import type { LibGeneratorSchema, LibType, NormalizedLibOptions, Platform } from '../@types';
import {
    DEFAULT_PLATFORM,
    DEFAULT_SCOPE,
    IMPORT_SCOPE,
    LIB_TYPES,
    PACKAGES_ROOT,
    PLATFORMS,
    TYPES_WITH_EXPLICIT_DIRECTORY,
} from './constants';
import { assertKebabCase, buildTags } from './naming';

function assertOneOf<T extends string>(value: string, allowed: readonly T[], label: string): asserts value is T {
    if (!allowed.includes(value as T)) {
        throw new Error(`${label} должно быть одним из: ${allowed.join(', ')}; получено "${value}"`);
    }
}

function resolveDirectory(name: string, type: LibType, directory: string | undefined): string {
    if (directory) {
        return directory.replace(/\\/g, '/').replace(/^\.?\/+|\/+$/g, '');
    }
    if (TYPES_WITH_EXPLICIT_DIRECTORY.includes(type)) {
        throw new Error(`Для типа "${type}" нужно явно указать directory (например, modules/<name>/api)`);
    }
    return `${PACKAGES_ROOT}/${type}/${name}`;
}

/** Проверяет опции генератора `lib` и вычисляет производные значения. */
export function normalizeLibOptions(options: LibGeneratorSchema): NormalizedLibOptions {
    const name = options.name?.trim() ?? '';
    assertKebabCase(name, 'name');

    const type: string = options.type;
    assertOneOf(type, LIB_TYPES, 'type');

    const platform: string = options.platform ?? DEFAULT_PLATFORM;
    assertOneOf<Platform>(platform, PLATFORMS, 'platform');

    const scope = options.scope ?? DEFAULT_SCOPE;
    assertKebabCase(scope, 'scope');

    const { className, fileName, propertyName } = names(name);
    const directory = resolveDirectory(name, type, options.directory);

    return {
        className,
        description: options.description?.trim() || `Пакет ${IMPORT_SCOPE}/${name}`,
        directory,
        fileName,
        importPath: options.importPath ?? `${IMPORT_SCOPE}/${name}`,
        name,
        platform,
        propertyName,
        scope,
        skipFormat: options.skipFormat ?? false,
        tags: buildTags({ platform, scope, type }),
        type,
    };
}
