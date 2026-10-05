import type { output, ZodError } from 'zod';
import { ru } from 'zod/locales';

import type { ConfigIssue, ConfigLoaderOptions, ConfigValue, LoadedConfig, ModuleSchema } from '../@types/index.js';
import { ConfigError } from './config-error.js';
import { loadConfig } from './config-loader.js';
import { MODULES_SECTION, type ModuleConfigToken } from './define-module-config.js';
import { deepFreeze, isConfigTree } from './merge.js';

/** Сообщения Zod на русском только для разбора конфига: глобальный `z.config` не трогаем. */
const RU_LOCALE = ru();

/** Раздел модуля не прошёл валидацию схемой: какой модуль, какой ключ, что ожидалось (E00.03, требование 6). */
export class ConfigValidationError extends ConfigError {
    public readonly module: string;

    constructor(module: string, issues: readonly ConfigIssue[]) {
        super(issues, `Конфигурация модуля "${module}" не прошла валидацию`);
        this.name = 'ConfigValidationError';
        this.module = module;
    }
}

/**
 * Читает разделы модулей из загруженного конфига: по токену доступен только `modules.<name>`, значения проходят
 * Zod-схему токена, результат заморожен и кэшируется по токену (один экземпляр на процесс).
 */
export class ModuleConfigReader {
    private readonly __cache: WeakMap<ModuleConfigToken, unknown>;

    private readonly __config: LoadedConfig;

    constructor(config: LoadedConfig) {
        this.__config = config;
        this.__cache = new WeakMap();
    }

    public get config(): LoadedConfig {
        return this.__config;
    }

    /** Сырой раздел `modules.<name>` без валидации; отсутствующий раздел — пустая таблица. */
    public section(token: ModuleConfigToken): ConfigValue {
        const modules = this.__config.tree[MODULES_SECTION];
        if (!isConfigTree(modules) || !Object.hasOwn(modules, token.name)) {
            return {};
        }
        return modules[token.name] ?? {};
    }

    public read<TSchema extends ModuleSchema>(token: ModuleConfigToken<TSchema>): Readonly<output<TSchema>> {
        if (this.__cache.has(token)) {
            return this.__cache.get(token) as Readonly<output<TSchema>>;
        }
        const result = token.schema.safeParse(this.section(token), { error: RU_LOCALE.localeError, reportInput: true });
        if (!result.success) {
            throw new ConfigValidationError(token.name, this.__toIssues(token, result.error));
        }
        const value = deepFreeze(result.data);
        this.__cache.set(token, value);
        return value;
    }

    private __toIssues(token: ModuleConfigToken, error: ZodError): ConfigIssue[] {
        return error.issues.map((issue) => {
            const keys = issue.path.map((segment) => String(segment));
            const missing = issue.code === 'invalid_type' && issue.input === undefined && keys.length > 0;
            const hint = missing
                ? ` (ключ "${keys.at(-1)}" в [${token.path}] или переменная ${token.envVariable(keys, this.__config.envPrefix)})`
                : '';
            return { message: `${issue.message}${hint}`, path: keys.join('.'), source: token.path };
        });
    }
}

/** Загружает конфиг с диска и читает раздел одного модуля (не-Nest код; для Nest см. E00.03.04). */
export function loadModuleConfig<TSchema extends ModuleSchema>(
    token: ModuleConfigToken<TSchema>,
    options?: ConfigLoaderOptions,
): Readonly<output<TSchema>> {
    return new ModuleConfigReader(loadConfig(options)).read(token);
}
