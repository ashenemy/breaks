import type { NonEmptyArray } from '@market/core-ts-utils';

import type { PlainObject } from '../@types/index.js';

/** UUID RFC 4122 (версии 1–8) и nil-UUID, регистр не важен. */
const UUID_PATTERN =
    /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|0{8}-0{4}-0{4}-0{4}-0{12})$/i;

/** ObjectId MongoDB: 24 шестнадцатеричных символа. */
const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;

export function isString(value: unknown): value is string {
    return typeof value === 'string';
}

/** Число без `NaN`; `Infinity` считается числом. */
export function isNumber(value: unknown): value is number {
    return typeof value === 'number' && !Number.isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
    return typeof value === 'boolean';
}

export function isBigInt(value: unknown): value is bigint {
    return typeof value === 'bigint';
}

export function isSymbol(value: unknown): value is symbol {
    return typeof value === 'symbol';
}

export function isFunction(value: unknown): value is (...args: never[]) => unknown {
    return typeof value === 'function';
}

export function isArray(value: unknown): value is readonly unknown[] {
    return Array.isArray(value);
}

/** Экземпляр `Date` с корректным временем (`new Date('x')` не проходит). */
export function isDate(value: unknown): value is Date {
    return value instanceof Date && !Number.isNaN(value.getTime());
}

/** Любой объект, кроме `null`: массивы, даты и экземпляры классов тоже объекты. */
export function isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null;
}

/** Объект, созданный литералом, `Object.create(null)` или `new Object()`; экземпляры классов и массивы не подходят. */
export function isPlainObject(value: unknown): value is PlainObject {
    if (!isObject(value) || Array.isArray(value)) {
        return false;
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    return prototype === null || prototype === Object.prototype;
}

export function isNil(value: unknown): value is null | undefined {
    return value === null || value === undefined;
}

/** Строка, в которой есть хотя бы один непробельный символ. */
export function isNonEmptyString(value: unknown): value is string {
    return isString(value) && value.trim() !== '';
}

/** Массив минимум с одним элементом; для типизированного массива сужает к `NonEmptyArray<T>`. */
export function isNonEmptyArray<T>(value: readonly T[]): value is NonEmptyArray<T>;
export function isNonEmptyArray(value: unknown): value is NonEmptyArray<unknown>;
export function isNonEmptyArray(value: unknown): boolean {
    return Array.isArray(value) && value.length > 0;
}

export function isUuid(value: unknown): value is string {
    return isString(value) && UUID_PATTERN.test(value);
}

export function isObjectId(value: unknown): value is string {
    return isString(value) && OBJECT_ID_PATTERN.test(value);
}
