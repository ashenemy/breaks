import { describe, expectTypeOf, it } from 'vitest';

import type {
    DeepPartial,
    DeepReadonly,
    KeysOfType,
    Mutable,
    Prettify,
    RequireAtLeastOne,
    ValueOf,
} from '../../src/index.js';

type Order = {
    id: string;
    total: number;
    createdAt: Date;
    lines: { sku: string; qty: number }[];
    meta: { tags: readonly string[]; notify: (message: string) => void };
};

describe('ValueOf и KeysOfType', () => {
    it('ValueOf объединяет типы значений', () => {
        expectTypeOf<ValueOf<{ a: 1; b: 'x' }>>().toEqualTypeOf<1 | 'x'>();
        expectTypeOf<ValueOf<Record<string, number>>>().toEqualTypeOf<number>();
    });

    it('KeysOfType выбирает ключи по типу значения, включая необязательные', () => {
        expectTypeOf<KeysOfType<Order, string>>().toEqualTypeOf<'id'>();
        expectTypeOf<KeysOfType<Order, number | Date>>().toEqualTypeOf<'total' | 'createdAt'>();
        expectTypeOf<KeysOfType<{ a?: string; b: number }, string | undefined>>().toEqualTypeOf<'a'>();
        expectTypeOf<KeysOfType<Order, bigint>>().toEqualTypeOf<never>();
    });
});

describe('DeepPartial', () => {
    it('делает необязательными поля на всех уровнях, не трогая листья', () => {
        expectTypeOf<DeepPartial<Order>>().toEqualTypeOf<{
            id?: string;
            total?: number;
            createdAt?: Date;
            lines?: { sku?: string; qty?: number }[];
            meta?: { tags?: readonly string[]; notify?: (message: string) => void };
        }>();
        expectTypeOf<Record<string, never>>().toExtend<DeepPartial<Order>>();
        expectTypeOf<{ lines: [{ sku: 'a' }] }>().toExtend<DeepPartial<Order>>();
        expectTypeOf<{ lines: [{ sku: 1 }] }>().not.toExtend<DeepPartial<Order>>();
        expectTypeOf<DeepPartial<string>>().toEqualTypeOf<string>();
        expectTypeOf<DeepPartial<Date>>().toEqualTypeOf<Date>();
    });
});

describe('DeepReadonly и Mutable', () => {
    it('DeepReadonly замораживает объекты, массивы, Map и Set на всех уровнях', () => {
        type Frozen = DeepReadonly<Order & { index: Map<string, { n: number }>; ids: Set<string> }>;
        expectTypeOf<Frozen['lines']>().toEqualTypeOf<readonly { readonly sku: string; readonly qty: number }[]>();
        expectTypeOf<Frozen['meta']['tags']>().toEqualTypeOf<readonly string[]>();
        expectTypeOf<Frozen['meta']['notify']>().toEqualTypeOf<(message: string) => void>();
        expectTypeOf<Frozen['createdAt']>().toEqualTypeOf<Date>();
        expectTypeOf<Frozen['index']>().toEqualTypeOf<ReadonlyMap<string, { readonly n: number }>>();
        expectTypeOf<Frozen['ids']>().toEqualTypeOf<ReadonlySet<string>>();
        expectTypeOf<DeepReadonly<number>>().toEqualTypeOf<number>();
    });

    it('Mutable снимает readonly только с верхнего уровня', () => {
        type Frozen = { readonly a: number; readonly nested: { readonly b: string } };
        expectTypeOf<Mutable<Frozen>>().toEqualTypeOf<{ a: number; nested: { readonly b: string } }>();
    });
});

describe('RequireAtLeastOne', () => {
    type Contact = { email?: string; phone?: string; name: string };
    type AtLeastOne = RequireAtLeastOne<Contact, 'email' | 'phone'>;

    it('требует хотя бы одно из указанных полей, остальные не меняет', () => {
        expectTypeOf<{ name: string; email: string }>().toExtend<AtLeastOne>();
        expectTypeOf<{ name: string; phone: string }>().toExtend<AtLeastOne>();
        expectTypeOf<{ name: string; email: string; phone: string }>().toExtend<AtLeastOne>();
        expectTypeOf<{ name: string }>().not.toExtend<AtLeastOne>();
        expectTypeOf<{ email: string }>().not.toExtend<AtLeastOne>();
    });

    it('по умолчанию требует хотя бы одно из всех полей', () => {
        type Filter = RequireAtLeastOne<{ a?: number; b?: number }>;
        expectTypeOf<{ a: 1 }>().toExtend<Filter>();
        expectTypeOf<Record<string, never>>().not.toExtend<Filter>();
    });
});

describe('Prettify', () => {
    it('разворачивает пересечение в плоский объект того же состава', () => {
        type Merged = Prettify<{ a: number } & { b: string }>;
        expectTypeOf<Merged>().toEqualTypeOf<{ a: number; b: string }>();
        expectTypeOf<keyof Merged>().toEqualTypeOf<'a' | 'b'>();
    });
});
