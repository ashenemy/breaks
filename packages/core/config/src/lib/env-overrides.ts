import type {
    ConfigIssue,
    ConfigTree,
    ConfigValue,
    EnvOverride,
    EnvOverridesResult,
    EnvRecord,
} from '../@types/index.js';
import { ConfigError } from './config-error.js';
import { isConfigTree } from './merge.js';
import { parseToml } from './toml.js';

/** Префикс переменных переопределения по умолчанию: `APP__MODULES__<NAME>__<KEY>` (E00.03, требование 4). */
export const DEFAULT_ENV_PREFIX = 'APP';

/** Разделитель сегментов пути в имени переменной. */
export const ENV_SEPARATOR = '__';

/** Сегмент имени: `UPPER_SNAKE_CASE` из латиницы и цифр. */
const SEGMENT_PATTERN = /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/;

/** `PAGE_SIZE` → `pageSize`, `S3_BUCKET` → `s3Bucket`, `CATALOG` → `catalog`: ключи TOML в camelCase. */
export function envSegmentToKey(segment: string): string {
    const [head = '', ...rest] = segment.toLowerCase().split('_');
    return head + rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

/** Обратное отображение для подсказок: `pageSize` → `PAGE_SIZE`, `s3Bucket` → `S3_BUCKET`, `catalog` → `CATALOG`. */
export function keyToEnvSegment(key: string): string {
    return key.replace(/([A-Z])/g, '_$1').toUpperCase();
}

/** Имя переменной для пути в дереве: `['modules', 'catalog', 'pageSize']` → `APP__MODULES__CATALOG__PAGE_SIZE`. */
export function envVariableFor(path: readonly string[], prefix: string = DEFAULT_ENV_PREFIX): string {
    return [prefix, ...path.map(keyToEnvSegment)].join(ENV_SEPARATOR);
}

/**
 * Приведение строки окружения к типу значения конфига. Тип задаёт текущее значение из TOML (строка остаётся
 * строкой, число и логическое значение разбираются строго). Без текущего значения строка читается как литерал
 * TOML (`20`, `true`, `["a", "b"]`, `"в кавычках"`), а если это не литерал — остаётся строкой.
 */
export function coerceEnvValue(
    raw: string,
    current: ConfigValue | undefined,
    source: string,
    path: string,
): ConfigValue {
    if (typeof current === 'string') {
        return raw;
    }
    if (typeof current === 'number') {
        const trimmed = raw.trim();
        const parsed = trimmed === '' ? Number.NaN : Number(trimmed);
        if (Number.isNaN(parsed)) {
            throw new ConfigError([{ message: `ожидается число, получено "${raw}"`, path, source }]);
        }
        return parsed;
    }
    if (typeof current === 'boolean') {
        if (raw === 'true' || raw === 'false') {
            return raw === 'true';
        }
        throw new ConfigError([{ message: `ожидается true или false, получено "${raw}"`, path, source }]);
    }
    return parseTomlLiteral(raw) ?? raw;
}

/** Переопределения из окружения: `<PREFIX>__A__B=value` записывается в `a.b` поверх слоёв TOML. */
export class EnvOverrides {
    private readonly __prefix: string;

    constructor(prefix: string = DEFAULT_ENV_PREFIX) {
        this.__prefix = `${prefix}${ENV_SEPARATOR}`;
    }

    public get prefix(): string {
        return this.__prefix;
    }

    /** Собирает переопределения в алфавитном порядке имён; имена вне формата дают одну ошибку на все. */
    public collect(env: EnvRecord): EnvOverride[] {
        const overrides: EnvOverride[] = [];
        const issues: ConfigIssue[] = [];
        for (const variable of Object.keys(env).sort()) {
            const raw = env[variable];
            if (raw === undefined || !variable.startsWith(this.__prefix)) {
                continue;
            }
            const segments = variable.slice(this.__prefix.length).split(ENV_SEPARATOR);
            if (segments.some((segment) => !SEGMENT_PATTERN.test(segment))) {
                issues.push({
                    message: `имя должно иметь вид ${this.__prefix}SEGMENT__SEGMENT, сегменты в UPPER_SNAKE_CASE`,
                    path: '',
                    source: variable,
                });
                continue;
            }
            overrides.push({ path: segments.map(envSegmentToKey), raw, variable });
        }
        if (issues.length > 0) {
            throw new ConfigError(issues);
        }
        return overrides;
    }

    /** Применяет переопределения к дереву и возвращает новое дерево; входное не изменяется. */
    public apply(tree: ConfigTree, env: EnvRecord): EnvOverridesResult {
        const overrides = this.collect(env);
        let result = tree;
        for (const override of overrides) {
            result = this.__assign(result, override, 0);
        }
        return { tree: result, variables: overrides.map((override) => override.variable) };
    }

    private __assign(tree: ConfigTree, override: EnvOverride, depth: number): ConfigTree {
        const key = override.path[depth] ?? '';
        const current = Object.hasOwn(tree, key) ? tree[key] : undefined;
        if (depth === override.path.length - 1) {
            return {
                ...tree,
                [key]: coerceEnvValue(override.raw, current, override.variable, override.path.join('.')),
            };
        }
        if (current !== undefined && !isConfigTree(current)) {
            throw new ConfigError([
                {
                    message: `путь проходит через значение "${override.path.slice(0, depth + 1).join('.')}", которое не является таблицей`,
                    path: override.path.join('.'),
                    source: override.variable,
                },
            ]);
        }
        return { ...tree, [key]: this.__assign(current ?? {}, override, depth + 1) };
    }
}

function parseTomlLiteral(raw: string): ConfigValue | undefined {
    if (raw.includes('\n')) {
        return undefined;
    }
    try {
        const table = parseToml(`value = ${raw}`);
        return Object.keys(table).length === 1 ? table['value'] : undefined;
    } catch {
        return undefined;
    }
}
