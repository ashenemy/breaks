import type { ConfigTree } from '../@types/index.js';

/** Таблица TOML: простой объект, а не массив, дата или скаляр. */
export function isConfigTree(value: unknown): value is ConfigTree {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

/**
 * Глубокое слияние слоёв: таблицы объединяются по ключам, всё остальное (скаляры, массивы, даты)
 * заменяется значением из `source`. Входные деревья не изменяются.
 */
export function deepMerge(target: ConfigTree, source: ConfigTree): ConfigTree {
    const result: ConfigTree = { ...target };
    for (const [key, value] of Object.entries(source)) {
        const current = Object.hasOwn(result, key) ? result[key] : undefined;
        result[key] = isConfigTree(value) ? deepMerge(isConfigTree(current) ? current : {}, value) : value;
    }
    return result;
}

/** Рекурсивно замораживает дерево: конфиг неизменяем в рантайме (E00.03, требование 7). */
export function deepFreeze<T>(value: T): Readonly<T> {
    if (typeof value !== 'object' || value === null || Object.isFrozen(value)) {
        return value;
    }
    Object.freeze(value);
    for (const item of Object.values(value)) {
        deepFreeze(item);
    }
    return value;
}
