import type { ModuleSchema } from '../@types/index.js';
import { ConfigError } from './config-error.js';
import { DEFAULT_ENV_PREFIX, envVariableFor } from './env-overrides.js';

/** Корневой раздел модулей в дереве конфига: `[modules.<name>]` (E00.03, требование 2). */
export const MODULES_SECTION = 'modules';

/** Имя модуля в camelCase (A-018): совпадает с ключом TOML и однозначно отображается в имя переменной. */
const MODULE_NAME_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

/**
 * Токен конфигурации модуля: имя раздела и Zod-схема. Тип значений выводится из схемы (`ModuleConfig<typeof TOKEN>`),
 * а читать по токену можно только собственный раздел `modules.<name>`.
 */
export class ModuleConfigToken<TSchema extends ModuleSchema = ModuleSchema> {
    /** Ключ внедрения зависимостей (Nest): уникален для токена, читается в `@InjectModuleConfig(token)`. */
    public readonly injectionToken: symbol;

    public readonly name: string;

    public readonly schema: TSchema;

    constructor(name: string, schema: TSchema) {
        if (!MODULE_NAME_PATTERN.test(name)) {
            throw new ConfigError([
                {
                    message: `имя модуля должно быть в camelCase (латиница и цифры, с маленькой буквы), получено "${name}"`,
                    path: '',
                    source: 'defineModuleConfig',
                },
            ]);
        }
        this.name = name;
        this.schema = schema;
        this.injectionToken = Symbol(`ModuleConfig(${name})`);
    }

    /** Путь раздела в дереве конфига: `modules.<name>`. */
    public get path(): string {
        return `${MODULES_SECTION}.${this.name}`;
    }

    /** Имя переменной окружения для ключа раздела: `envVariable(['pageSize'])` → `APP__MODULES__CATALOG__PAGE_SIZE`. */
    public envVariable(keys: readonly string[], prefix: string = DEFAULT_ENV_PREFIX): string {
        return envVariableFor([MODULES_SECTION, this.name, ...keys], prefix);
    }
}

/** Объявляет раздел модуля: `defineModuleConfig('catalog', z.strictObject({ pageSize: z.number().int() }))`. */
export function defineModuleConfig<TSchema extends ModuleSchema>(
    name: string,
    schema: TSchema,
): ModuleConfigToken<TSchema> {
    return new ModuleConfigToken(name, schema);
}
