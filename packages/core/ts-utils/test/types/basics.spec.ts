import { describe, expectTypeOf, it } from 'vitest';

import type {
    Any,
    Awaitable,
    Constructor,
    JsonArray,
    JsonObject,
    JsonPrimitive,
    JsonValue,
    Nullable,
    Optional,
    Primitive,
} from '../../src/index.js';

describe('Any', () => {
    it('принимает и отдаёт что угодно, оставаясь единственным any', () => {
        expectTypeOf<Any>().toBeAny();
        expectTypeOf<string>().toExtend<Any>();
        expectTypeOf<Any>().toExtend<number>();
    });
});

describe('Nullable, Optional, Awaitable', () => {
    it('добавляют null, undefined и PromiseLike', () => {
        expectTypeOf<Nullable<string>>().toEqualTypeOf<string | null>();
        expectTypeOf<Optional<number>>().toEqualTypeOf<number | undefined>();
        expectTypeOf<Awaitable<boolean>>().toEqualTypeOf<boolean | PromiseLike<boolean>>();
        expectTypeOf<Promise<boolean>>().toExtend<Awaitable<boolean>>();
        expectTypeOf<Nullable<string>>().not.toExtend<string>();
    });
});

describe('Constructor', () => {
    class Service {
        public readonly name: string;

        constructor(name: string, retries: number) {
            this.name = `${name}:${retries}`;
        }
    }

    it('описывает класс с экземпляром и аргументами конструктора', () => {
        expectTypeOf<typeof Service>().toExtend<Constructor<Service>>();
        expectTypeOf<typeof Service>().toExtend<Constructor<Service, [string, number]>>();
        expectTypeOf<typeof Service>().not.toExtend<Constructor<Service, [number]>>();
        expectTypeOf<InstanceType<Constructor<Date>>>().toEqualTypeOf<Date>();
    });
});

describe('Primitive и JSON', () => {
    it('Primitive перечисляет примитивы и не включает объекты', () => {
        expectTypeOf<Primitive>().toEqualTypeOf<bigint | boolean | null | number | string | symbol | undefined>();
        expectTypeOf<object>().not.toExtend<Primitive>();
    });

    it('JsonValue допускает только сериализуемые значения', () => {
        expectTypeOf<JsonPrimitive>().toEqualTypeOf<boolean | null | number | string>();
        expectTypeOf<{ a: [1, 'x', null, { b: true }] }>().toExtend<JsonValue>();
        expectTypeOf<JsonArray>().toEqualTypeOf<JsonValue[]>();
        expectTypeOf<JsonObject>().toExtend<JsonValue>();
        expectTypeOf<{ when: Date }>().not.toExtend<JsonValue>();
        expectTypeOf<{ value: undefined }>().not.toExtend<JsonValue>();
        expectTypeOf<() => void>().not.toExtend<JsonValue>();
        expectTypeOf<bigint>().not.toExtend<JsonValue>();
    });
});
