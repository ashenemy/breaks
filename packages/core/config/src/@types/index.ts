/**
 * Все типы пакета @market/core-config: внутренние и публичные (02-code-conventions.md, раздел 1).
 * Публичные типы реэкспортируются через src/index.ts в форме `export type`.
 */

import type { output, ZodType } from 'zod';

import type { ModuleConfigToken } from '../lib/define-module-config.js';
import type { SecretPolicy } from '../lib/secrets.js';

/** Значения раздела модуля, выведенные из Zod-схемы токена: `ModuleConfig<typeof CATALOG_CONFIG>`. */
export type ModuleConfig<TToken extends ModuleConfigToken> =
    TToken extends ModuleConfigToken<infer TSchema> ? Readonly<output<TSchema>> : never;

/** Схема раздела модуля: любой тип Zod; для защиты от опечаток в ключах рекомендуется `z.strictObject`. */
export type ModuleSchema = ZodType;

/** Окружение приложения: имя файла слоя `config/<env>.toml` (E00.03, требование 1). */
export type AppEnvironment = 'dev' | 'prod' | 'staging' | 'test';

/** Значение конфига: всё, что умеет выражать TOML (даты приходят из парсера как `Date`). */
export type ConfigValue = boolean | ConfigTree | ConfigValue[] | Date | number | string;

/** Таблица TOML после слияния слоёв. */
export type ConfigTree = {
    [key: string]: ConfigValue;
};

/** Имя слоя в порядке слияния: файлы TOML, затем `.env`, затем переменные окружения. */
export type ConfigLayerName = AppEnvironment | 'default' | 'dotenv' | 'env' | 'local';

/** Диагностика слоя без значений: откуда прочитан, присутствовал ли, какие переменные применены. */
export type ConfigLayerInfo = {
    name: ConfigLayerName;
    present: boolean;
    source: string;
    /** Только для слоя `env`: имена применённых переменных (значения не раскрываются). */
    variables?: readonly string[];
};

/** Одна проблема загрузки: источник (файл или переменная), путь в дереве и сообщение. */
export type ConfigIssue = {
    message: string;
    path: string;
    source: string;
};

/** Переменные окружения в форме `process.env`. */
export type EnvRecord = Readonly<Record<string, string | undefined>>;

/** Переменные окружения без неопределённых значений (после слияния `.env` и `process.env`). */
export type EnvValues = Readonly<Record<string, string>>;

/** Одно переопределение из окружения: имя переменной, путь в дереве и сырое значение. */
export type EnvOverride = {
    path: readonly string[];
    raw: string;
    variable: string;
};

/** Результат применения переопределений: новое дерево и имена применённых переменных. */
export type EnvOverridesResult = {
    tree: ConfigTree;
    variables: readonly string[];
};

/** Результат чтения одного слоя TOML. */
export type TomlLayerResult = {
    info: ConfigLayerInfo;
    tree: ConfigTree;
};

/** Настройки загрузчика; умолчания описаны в `ConfigLoader`. */
export type ConfigLoaderOptions = {
    /** Каталог с `default.toml`, `<env>.toml`, `local.toml`. По умолчанию `<cwd>/config`. */
    configDir?: string;
    /** Путь к `.env`; `null` отключает чтение. По умолчанию `<cwd>/.env`. */
    dotenvPath?: string | null;
    /** Переменные окружения. По умолчанию `process.env`. */
    env?: EnvRecord;
    /** Префикс переопределений `<PREFIX>__A__B`. По умолчанию `APP`. */
    envPrefix?: string;
    /** Окружение; по умолчанию выводится из `APP_ENV`, затем `NODE_ENV`, иначе `dev`. */
    environment?: AppEnvironment;
    /** Политика секретов для проверки слоёв TOML. По умолчанию слова `secret`, `password`, `token`, `key`. */
    secrets?: SecretPolicy;
};

/** Загруженная конфигурация: деревья заморожены, значения в рантайме неизменяемы (E00.03, требование 7). */
export type LoadedConfig = {
    environment: AppEnvironment;
    /** Префикс переменных переопределения без разделителя (`APP`): нужен для подсказок в ошибках. */
    envPrefix: string;
    /** Дерево после слияния файлов TOML до переопределений окружением: нужно для запрета секретов в TOML. */
    fileTree: ConfigTree;
    /** Слои в порядке слияния с диагностикой присутствия. */
    layers: readonly ConfigLayerInfo[];
    /** Итоговое дерево: файлы, затем переопределения окружением. */
    tree: ConfigTree;
};
