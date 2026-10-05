/**
 * Все типы пакета @market/core-ts-utils (02-code-conventions.md, раздел 1). Пакет содержит только типы:
 * кода времени выполнения нет, проверяются они type-тестами (`expectTypeOf`, Vitest typecheck).
 */
/**
 * Единственное место, где разрешён `any` (02-code-conventions.md, раздел 1). Порядок выбора: generics,
 * затем `unknown`, затем `Any`. Нужен там, где `unknown` не подходит: ограничения generic-параметров
 * (`TArgs extends Any[]`), совместимость с внешними сигнатурами, условные типы над функциями.
 */
// biome-ignore lint/suspicious/noExplicitAny: единственный разрешённый алиас any, см. описание выше
export type Any = any;
/** Значение или `null`. */
export type Nullable<T> = T | null;
/** Значение или `undefined`. */
export type Optional<T> = T | undefined;
/** Значение или обещание значения: для API, принимающих и синхронные, и асинхронные реализации. */
export type Awaitable<T> = T | PromiseLike<T>;
/** Класс (конструктор) с экземпляром `T` и аргументами `TArgs`; для DI и фабрик. */
export type Constructor<T = object, TArgs extends readonly unknown[] = Any[]> = new (...args: TArgs) => T;
/** Объединение типов значений объекта: `ValueOf<{ a: 1; b: 'x' }>` → `1 | 'x'`. */
export type ValueOf<T> = T[keyof T];
/** Ключи `T`, значения которых совместимы с `V`: `KeysOfType<{ a: string; b: number }, string>` → `'a'`. */
export type KeysOfType<T, V> = {
    [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];
/** Примитивы JavaScript. */
export type Primitive = bigint | boolean | null | number | string | symbol | undefined;
/** Любая функция; используется только в условных типах, чтобы не углубляться в сигнатуры. */
type AnyFunction = (...args: Any[]) => unknown;
/** Листовые типы, которые глубокие преобразования не раскрывают. */
type DeepLeaf = AnyFunction | Date | Primitive | RegExp;
/** Все поля необязательны на любой глубине; массивы преобразуются поэлементно, листья не меняются. */
export type DeepPartial<T> = T extends DeepLeaf
    ? T
    : T extends readonly (infer U)[]
      ? T extends unknown[]
          ? DeepPartial<U>[]
          : readonly DeepPartial<U>[]
      : T extends object
        ? { [K in keyof T]?: DeepPartial<T[K]> }
        : T;
/** Все поля только для чтения на любой глубине, включая массивы, `Map` и `Set`. */
export type DeepReadonly<T> = T extends DeepLeaf
    ? T
    : T extends ReadonlyMap<infer K, infer V>
      ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
      : T extends ReadonlySet<infer U>
        ? ReadonlySet<DeepReadonly<U>>
        : T extends readonly (infer U)[]
          ? readonly DeepReadonly<U>[]
          : T extends object
            ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
            : T;
/** Снимает `readonly` с полей верхнего уровня. */
export type Mutable<T> = {
    -readonly [K in keyof T]: T[K];
};
/** Хотя бы одно из полей `K` обязательно; остальные поля `T` без изменений. */
export type RequireAtLeastOne<T, K extends keyof T = keyof T> = Omit<T, K> &
    {
        [P in K]-?: Required<Pick<T, P>> & Partial<Pick<T, Exclude<K, P>>>;
    }[K];
/** Массив минимум с одним элементом. */
export type NonEmptyArray<T> = [T, ...T[]];
declare const BRAND: unique symbol;
/** Номинальный тип поверх структурного: `Brand<string, 'OrderId'>` не присваивается `Brand<string, 'UserId'>`. */
export type Brand<T, B extends string> = T & {
    readonly [BRAND]: B;
};
/** Разворачивает пересечения и mapped-типы в плоский объект для подсказок IDE и сообщений об ошибках. */
export type Prettify<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;
/** Объединение в пересечение: `UnionToIntersection<{ a: 1 } | { b: 2 }>` → `{ a: 1 } & { b: 2 }`. */
export type UnionToIntersection<U> = (U extends unknown ? (argument: U) => void : never) extends (
    argument: infer I,
) => void
    ? I
    : never;
/** Результат операции без исключений: успех со значением или ошибка. */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
/** Примитивы JSON. */
export type JsonPrimitive = boolean | null | number | string;
/** Объект JSON. */
export type JsonObject = {
    [key: string]: JsonValue;
};
/** Массив JSON. */
export type JsonArray = JsonValue[];
/** Любое значение, сериализуемое в JSON без потерь. */
export type JsonValue = JsonArray | JsonObject | JsonPrimitive;
