import type { LibType, Platform } from '../@types';

/** Коллекция генераторов воркспейса (имя пакета плагина). */
export const GENERATOR_COLLECTION = '@market/tooling';

/** Полное имя генератора библиотек, записывается в маркер проекта. */
export const LIB_GENERATOR = `${GENERATOR_COLLECTION}:lib`;

/** Executor Vitest воркспейса: цель `test` сгенерированных проектов. */
export const VITEST_EXECUTOR = `${GENERATOR_COLLECTION}:vitest`;

/** Npm-scope импортов воркспейса (ADR-0002, правило 6). */
export const IMPORT_SCOPE = '@market';

/** Scope по умолчанию для кода без домена (ADR-0014). */
export const DEFAULT_SCOPE = 'shared';

/** Платформа по умолчанию для библиотек: не зависит от среды выполнения. */
export const DEFAULT_PLATFORM: Platform = 'shared';

/** Порог покрытия строк и веток для сгенерированных пакетов (02-code-conventions.md, раздел 10). */
export const COVERAGE_THRESHOLD = 90;

/** Корневой каталог пакетов: `packages/<type>/<name>` (01-architecture.md, раздел 4). */
export const PACKAGES_ROOT = 'packages';

export const LIB_TYPES: readonly LibType[] = ['contracts', 'core', 'infra', 'module', 'tooling', 'ui'];

export const PLATFORMS: readonly Platform[] = ['api', 'native', 'shared', 'web'];

/** Типы, у которых каталог нельзя вывести из имени: его задаёт вызывающий генератор. */
export const TYPES_WITH_EXPLICIT_DIRECTORY: readonly LibType[] = ['module'];

/** Имена в kebab-case: буквы, цифры и одиночные дефисы (02-code-conventions.md, раздел 2). */
export const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Отступ JSON-файлов воркспейса (02-code-conventions.md, раздел 1). */
export const JSON_INDENT = 4;
