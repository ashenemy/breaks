/**
 * Теги проектов Nx и правила границ между ними (ADR-0014, эпик E00.01).
 *
 * Каждый проект несёт ровно три тега:
 *   scope:<domain|shared>  — доменная область (catalog, orders, ...) или общий код;
 *   type:<...>             — роль проекта: app | core | contracts | ui | tooling | infra | module;
 *   platform:<...>         — среда выполнения: api (Node.js: сервер, воркеры, инструменты),
 *                            web (браузер), native (NativeScript), shared (не зависит от среды).
 *
 * Ограничения — списки разрешённых тегов зависимостей (`onlyDependOnLibsWithTags`).
 * Импорт разрешён, только если он проходит все ограничения, подходящие к тегам источника.
 * Проект без подходящего ограничения не может импортировать ничего (поведение правила Nx),
 * проект без тегов не может быть зависимостью.
 *
 * Файл временный: в E00.02 источником становится раздел `[boundaries]` в
 * `packages/tooling/lint/rules.toml`, а `eslint.config.mjs` генерируется из него.
 */

const PLATFORM_API = 'platform:api';
const PLATFORM_NATIVE = 'platform:native';
const PLATFORM_SHARED = 'platform:shared';
const PLATFORM_WEB = 'platform:web';

const TYPE_APP = 'type:app';
const TYPE_CONTRACTS = 'type:contracts';
const TYPE_CORE = 'type:core';
const TYPE_INFRA = 'type:infra';
const TYPE_MODULE = 'type:module';
const TYPE_TOOLING = 'type:tooling';
const TYPE_UI = 'type:ui';

const SCOPE_ANY = 'scope:*';
const SCOPE_SHARED = 'scope:shared';

/** Среда выполнения: платформенный код видит только свою платформу и общий код. */
const PLATFORM_CONSTRAINTS = [
    { sourceTag: PLATFORM_API, onlyDependOnLibsWithTags: [PLATFORM_API, PLATFORM_SHARED] },
    { sourceTag: PLATFORM_WEB, onlyDependOnLibsWithTags: [PLATFORM_WEB, PLATFORM_SHARED] },
    { sourceTag: PLATFORM_NATIVE, onlyDependOnLibsWithTags: [PLATFORM_NATIVE, PLATFORM_SHARED] },
    { sourceTag: PLATFORM_SHARED, onlyDependOnLibsWithTags: [PLATFORM_SHARED] },
];

/**
 * Роль проекта: слои зависят только вниз.
 * app → module → (ui | infra) → contracts → core; tooling никем не импортируется.
 */
const TYPE_CONSTRAINTS = [
    { sourceTag: TYPE_APP, onlyDependOnLibsWithTags: [TYPE_MODULE, TYPE_UI, TYPE_INFRA, TYPE_CONTRACTS, TYPE_CORE] },
    {
        sourceTag: TYPE_MODULE,
        onlyDependOnLibsWithTags: [TYPE_MODULE, TYPE_UI, TYPE_INFRA, TYPE_CONTRACTS, TYPE_CORE],
    },
    { sourceTag: TYPE_UI, onlyDependOnLibsWithTags: [TYPE_UI, TYPE_CONTRACTS, TYPE_CORE] },
    { sourceTag: TYPE_INFRA, onlyDependOnLibsWithTags: [TYPE_INFRA, TYPE_CONTRACTS, TYPE_CORE] },
    { sourceTag: TYPE_CONTRACTS, onlyDependOnLibsWithTags: [TYPE_CONTRACTS, TYPE_CORE] },
    { sourceTag: TYPE_CORE, onlyDependOnLibsWithTags: [TYPE_CORE] },
    {
        sourceTag: TYPE_TOOLING,
        onlyDependOnLibsWithTags: [TYPE_TOOLING, TYPE_MODULE, TYPE_UI, TYPE_INFRA, TYPE_CONTRACTS, TYPE_CORE],
    },
];

/**
 * Домен: общий код библиотек не зависит от доменного. Приложения и инструменты —
 * точки сборки, им разрешён любой домен. Доменные проекты пока могут зависеть от любого
 * домена; точечные запреты между доменами добавляются вместе с модулями.
 */
const SCOPE_CONSTRAINTS = [
    ...[TYPE_CORE, TYPE_CONTRACTS, TYPE_UI, TYPE_INFRA, TYPE_MODULE].map((type) => ({
        allSourceTags: [SCOPE_SHARED, type],
        onlyDependOnLibsWithTags: [SCOPE_SHARED],
    })),
    { sourceTag: SCOPE_ANY, onlyDependOnLibsWithTags: [SCOPE_ANY] },
];

/** Порядок важен: при нарушении нескольких ограничений правило сообщает о первом. */
export const DEP_CONSTRAINTS = [...PLATFORM_CONSTRAINTS, ...TYPE_CONSTRAINTS, ...SCOPE_CONSTRAINTS];

export const PLATFORM_TAGS = [PLATFORM_API, PLATFORM_WEB, PLATFORM_NATIVE, PLATFORM_SHARED];
export const TYPE_TAGS = [TYPE_APP, TYPE_MODULE, TYPE_UI, TYPE_INFRA, TYPE_CONTRACTS, TYPE_CORE, TYPE_TOOLING];
