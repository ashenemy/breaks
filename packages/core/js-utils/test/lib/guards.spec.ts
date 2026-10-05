import type { NonEmptyArray } from '@market/core-ts-utils';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
    isArray,
    isBigInt,
    isBoolean,
    isDate,
    isFunction,
    isNil,
    isNonEmptyArray,
    isNonEmptyString,
    isNumber,
    isObject,
    isObjectId,
    isPlainObject,
    isString,
    isSymbol,
    isUuid,
} from '../../src/index.js';

class Point {
    public readonly x: number = 1;
}

/** Образцы всех категорий значений: каждый guard проверяется на полном наборе. */
const SAMPLES = {
    array: [1, 2],
    bigint: 10n,
    boolean: false,
    date: new Date('2026-10-05T00:00:00Z'),
    emptyArray: [] as unknown[],
    emptyString: '',
    fn: () => 1,
    infinity: Number.POSITIVE_INFINITY,
    instance: new Point(),
    invalidDate: new Date('not a date'),
    nan: Number.NaN,
    null: null,
    nullProto: Object.create(null) as object,
    number: 42,
    plain: { a: 1 },
    string: 'text',
    symbol: Symbol('s'),
    undefined: undefined,
    whitespace: '  \n\t',
    zero: 0,
} as const;

type SampleName = keyof typeof SAMPLES;

function accepted(guard: (value: unknown) => boolean): SampleName[] {
    return (Object.keys(SAMPLES) as SampleName[]).filter((name) => guard(SAMPLES[name])).sort();
}

describe('примитивные guards', () => {
    it('isString, isNonEmptyString', () => {
        expect(accepted(isString)).toEqual(['emptyString', 'string', 'whitespace']);
        expect(accepted(isNonEmptyString)).toEqual(['string']);
        const value: unknown = 'x';
        if (isString(value)) {
            expectTypeOf(value).toEqualTypeOf<string>();
        }
    });

    it('isNumber отвергает NaN, но принимает 0 и Infinity', () => {
        expect(accepted(isNumber)).toEqual(['infinity', 'number', 'zero']);
    });

    it('isBoolean, isBigInt, isSymbol, isNil', () => {
        expect(accepted(isBoolean)).toEqual(['boolean']);
        expect(accepted(isBigInt)).toEqual(['bigint']);
        expect(accepted(isSymbol)).toEqual(['symbol']);
        expect(accepted(isNil)).toEqual(['null', 'undefined']);
        const value: string | null | undefined = 'x' as string | null | undefined;
        if (!isNil(value)) {
            expectTypeOf(value).toEqualTypeOf<string>();
        }
    });

    it('isFunction принимает функции и классы', () => {
        expect(accepted(isFunction)).toEqual(['fn']);
        expect(isFunction(Point)).toBe(true);
        expect(isFunction(Math.max)).toBe(true);
    });
});

describe('объектные guards', () => {
    it('isArray, isNonEmptyArray', () => {
        expect(accepted(isArray)).toEqual(['array', 'emptyArray']);
        expect(accepted(isNonEmptyArray)).toEqual(['array']);
        const list: number[] = [1];
        if (isNonEmptyArray(list)) {
            expectTypeOf(list).toEqualTypeOf<NonEmptyArray<number>>();
            expectTypeOf(list[0]).toEqualTypeOf<number>();
        }
    });

    it('isDate принимает только валидные даты', () => {
        expect(accepted(isDate)).toEqual(['date']);
        expect(isDate(new Date(0))).toBe(true);
        expect(isDate(Date.now())).toBe(false);
    });

    it('isObject включает массивы, даты и экземпляры, но не null', () => {
        expect(accepted(isObject)).toEqual([
            'array',
            'date',
            'emptyArray',
            'instance',
            'invalidDate',
            'nullProto',
            'plain',
        ]);
    });

    it('isPlainObject принимает литералы и Object.create(null), отвергает экземпляры и массивы', () => {
        expect(accepted(isPlainObject)).toEqual(['nullProto', 'plain']);
        expect(isPlainObject(new Object())).toBe(true);
        expect(isPlainObject(Object.create({ inherited: true }))).toBe(false);
        const value: unknown = { a: 1 };
        if (isPlainObject(value)) {
            expectTypeOf(value).toEqualTypeOf<Record<string, unknown>>();
        }
    });
});

describe('идентификаторы', () => {
    it('isUuid принимает RFC 4122 версии 1–8 и nil в любом регистре', () => {
        expect(isUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
        expect(isUuid('019276C0-6A4B-7000-8000-000000000000')).toBe(true);
        expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(true);
        expect(isUuid('123e4567-e89b-02d3-a456-426614174000')).toBe(false);
        expect(isUuid('123e4567-e89b-12d3-c456-426614174000')).toBe(false);
        expect(isUuid('123e4567e89b12d3a456426614174000')).toBe(false);
        expect(isUuid('123e4567-e89b-12d3-a456-42661417400')).toBe(false);
        expect(isUuid(42)).toBe(false);
        expect(accepted(isUuid)).toEqual([]);
    });

    it('isObjectId принимает 24 шестнадцатеричных символа', () => {
        expect(isObjectId('507f1f77bcf86cd799439011')).toBe(true);
        expect(isObjectId('507F1F77BCF86CD799439011')).toBe(true);
        expect(isObjectId('507f1f77bcf86cd79943901')).toBe(false);
        expect(isObjectId('507f1f77bcf86cd79943901g')).toBe(false);
        expect(isObjectId(507)).toBe(false);
        expect(accepted(isObjectId)).toEqual([]);
    });
});
