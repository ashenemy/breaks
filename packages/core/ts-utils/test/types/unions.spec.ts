import { describe, expectTypeOf, it } from 'vitest';

import type { Brand, NonEmptyArray, Result, UnionToIntersection } from '../../src/index.js';

describe('NonEmptyArray', () => {
    it('требует хотя бы один элемент и остаётся массивом', () => {
        expectTypeOf<[1]>().toExtend<NonEmptyArray<number>>();
        expectTypeOf<[1, 2, 3]>().toExtend<NonEmptyArray<number>>();
        expectTypeOf<[]>().not.toExtend<NonEmptyArray<number>>();
        expectTypeOf<number[]>().not.toExtend<NonEmptyArray<number>>();
        expectTypeOf<NonEmptyArray<string>>().toExtend<string[]>();
        expectTypeOf<NonEmptyArray<string>[0]>().toEqualTypeOf<string>();
    });
});

describe('Brand', () => {
    type OrderId = Brand<string, 'OrderId'>;
    type UserId = Brand<string, 'UserId'>;

    it('делает одинаковые структурные типы несовместимыми между собой и с базовым типом', () => {
        expectTypeOf<OrderId>().toExtend<string>();
        expectTypeOf<string>().not.toExtend<OrderId>();
        expectTypeOf<OrderId>().not.toExtend<UserId>();
        expectTypeOf<UserId>().not.toExtend<OrderId>();
        expectTypeOf<Brand<number, 'Minor'>>().toExtend<number>();
    });
});

describe('UnionToIntersection', () => {
    it('превращает объединение объектов в пересечение', () => {
        expectTypeOf<UnionToIntersection<{ a: 1 } | { b: 2 }>>().toEqualTypeOf<{ a: 1 } & { b: 2 }>();
        expectTypeOf<UnionToIntersection<{ a: 1 }>>().toEqualTypeOf<{ a: 1 }>();
        expectTypeOf<UnionToIntersection<string | number>>().toEqualTypeOf<never>();
    });
});

describe('Result', () => {
    it('различает успех и ошибку по дискриминанту ok', () => {
        type Parsed = Result<number, string>;
        expectTypeOf<Parsed>().toEqualTypeOf<{ ok: true; value: number } | { ok: false; error: string }>();
        expectTypeOf<Result<number>>().toEqualTypeOf<{ ok: true; value: number } | { ok: false; error: Error }>();
        expectTypeOf<Extract<Parsed, { ok: true }>['value']>().toEqualTypeOf<number>();
        expectTypeOf<Extract<Parsed, { ok: false }>['error']>().toEqualTypeOf<string>();
        expectTypeOf<{ ok: true; error: string }>().not.toExtend<Parsed>();
    });
});
