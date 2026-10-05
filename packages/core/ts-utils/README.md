# @market/core-ts-utils

Утилитарные типы TypeScript: `Any`, `Nullable`, `DeepPartial`, `Brand`, `Result` и другие; без кода времени выполнения.

| | |
|---|---|
| Проект Nx | `core-ts-utils` |
| Каталог | `packages/core/ts-utils` |
| Теги | `scope:shared`, `type:core`, `platform:shared` |
| Создан | `@market/tooling:lib` |

## Назначение

Единое место для типов, используемых больше одного раза (02-code-conventions.md, раздел 1). Пакет содержит только типы: ни одной функции и ни одного байта в бандле. Здесь же живёт единственный разрешённый алиас `Any`.

## Публичный API

Экспортируется только через `src/index.ts`, строго именованно (`export type`):

| Тип | Что делает |
|---|---|
| `Any` | Единственное место с `any`. Порядок выбора: generics → `unknown` → `Any` |
| `Nullable<T>`, `Optional<T>` | `T \| null`, `T \| undefined` |
| `Awaitable<T>` | `T \| PromiseLike<T>` для синхронных и асинхронных реализаций |
| `Constructor<T, TArgs>` | Класс с экземпляром `T` и аргументами конструктора `TArgs` (DI, фабрики) |
| `ValueOf<T>` | Объединение типов значений объекта |
| `KeysOfType<T, V>` | Ключи `T`, значения которых совместимы с `V` |
| `DeepPartial<T>` | Необязательные поля на всех уровнях; массивы поэлементно, `Date`, `RegExp`, функции и примитивы без изменений |
| `DeepReadonly<T>` | `readonly` на всех уровнях, включая массивы, `Map` и `Set` |
| `Mutable<T>` | Снимает `readonly` с верхнего уровня |
| `RequireAtLeastOne<T, K>` | Хотя бы одно из полей `K` обязательно |
| `NonEmptyArray<T>` | `[T, ...T[]]` |
| `Brand<T, B>` | Номинальный тип: `Brand<string, 'OrderId'>` несовместим с `Brand<string, 'UserId'>` и с голым `string` |
| `Prettify<T>` | Плоский объект вместо пересечений в подсказках IDE |
| `UnionToIntersection<U>` | `{ a } \| { b }` → `{ a } & { b }` |
| `Result<T, E = Error>` | `{ ok: true; value } \| { ok: false; error }` |
| `Primitive` | Примитивы JavaScript |
| `JsonValue`, `JsonObject`, `JsonArray`, `JsonPrimitive` | Значения, сериализуемые в JSON без потерь |

## Примеры

```ts
import type { Brand, DeepPartial, RequireAtLeastOne, Result } from '@market/core-ts-utils';

type OrderId = Brand<string, 'OrderId'>;
const orderId = 'ord_1' as OrderId; // голый string сюда не присвоить

type OrderPatch = DeepPartial<{ lines: { sku: string; qty: number }[]; note: string }>;
const patch: OrderPatch = { lines: [{ qty: 2 }] };

type Contact = RequireAtLeastOne<{ email?: string; phone?: string }>;
const contact: Contact = { phone: '+374…' }; // {} не пройдёт

function parsePort(raw: string): Result<number, string> {
    const port = Number(raw);
    return Number.isInteger(port) ? { ok: true, value: port } : { ok: false, error: `не число: ${raw}` };
}
```

## Тесты

Тесты в `test/types/*.spec.ts` — утверждения `expectTypeOf`. Vitest запускает их и как обычные тесты, и в режиме `typecheck` (`tsc` поверх `tsconfig.spec.json`): несовпадение типов валит прогон. Цель `test` зависит от `build`, потому что `tsconfig.spec.json` ссылается на собранные объявления пакета. Покрытие кода неприменимо (кода нет), отчёт покрытия пустой.

## Команды

| Команда | Что делает |
|---|---|
| `nx lint core-ts-utils` | ESLint с правилами воркспейса и границами модулей |
| `nx test core-ts-utils` | Vitest: runtime и typecheck-прогон type-тестов (приёмка E00.05.01) |
| `nx build core-ts-utils` | Сборка `tsc` в `dist/` (только `.d.ts` с типами и пустой `index.js`) |
