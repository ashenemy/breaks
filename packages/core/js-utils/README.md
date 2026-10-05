# @market/core-js-utils

Общие функции времени выполнения: проверки типов, утверждения, коллекции, объекты, асинхронность, строки.

| | |
|---|---|
| Проект Nx | `core-js-utils` |
| Каталог | `packages/core/js-utils` |
| Теги | `scope:shared`, `type:core`, `platform:shared` |
| Создан | `@market/tooling:lib` |

## Назначение

Единое место для функций, используемых больше одного раза (02-code-conventions.md, раздел 1). Зависит только от стандартной библиотеки и типов `@market/core-ts-utils`. Каждая функция задокументирована и покрыта тестами на граничные случаи; порог покрытия 95% (эпик E00.05).

## Публичный API

Экспортируется только через `src/index.ts`, строго именованно.

### Проверки типов (`src/lib/guards.ts`)

| Функция | Что принимает |
|---|---|
| `isString`, `isBoolean`, `isBigInt`, `isSymbol` | Соответствующий примитив |
| `isNumber` | Число, включая `0` и `Infinity`, но не `NaN` |
| `isFunction` | Функции и классы |
| `isArray` | Массив (`readonly unknown[]`) |
| `isNonEmptyArray` | Массив хотя бы с одним элементом; для `T[]` сужает к `NonEmptyArray<T>` |
| `isDate` | Экземпляр `Date` с корректным временем (`new Date('x')` не проходит) |
| `isObject` | Любой объект, кроме `null`: массивы, даты и экземпляры тоже |
| `isPlainObject` | Литерал, `new Object()` или `Object.create(null)`; экземпляры классов и массивы нет |
| `isNil` | `null` или `undefined` |
| `isNonEmptyString` | Строка хотя бы с одним непробельным символом |
| `isUuid` | UUID RFC 4122 версий 1–8 и nil-UUID, регистр не важен |
| `isObjectId` | ObjectId MongoDB: 24 шестнадцатеричных символа |

### Утверждения (`src/lib/assertions.ts`)

| Функция | Что делает |
|---|---|
| `invariant(condition, message?)` | Бросает `InvariantError`, если условие ложно; сужает тип условия |
| `assertNever(value, message?)` | Исчерпывающий `switch`: компилятор не пропустит новый вариант, в рантайме сообщается значение |
| `assertDefined(value, message?)` | Утверждает, что значение не `null` и не `undefined` |
| `InvariantError` | Ошибка утверждений (наследует `Error`, `name = 'InvariantError'`) |

Сообщение — строка или ленивая функция `() => string` (тип `AssertionMessage`), чтобы не собирать строку на горячем пути.

Типы: `TypeGuard<T>`, `AssertionMessage`, `PlainObject`.

Коллекции, объекты, асинхронные помощники и строки добавляются задачами E00.05.03–E00.05.04.

## Примеры

```ts
import { assertDefined, assertNever, invariant, isNonEmptyArray, isPlainObject } from '@market/core-js-utils';

function firstSku(lines: { sku: string }[]): string {
    invariant(isNonEmptyArray(lines), () => `пустой заказ (${lines.length} строк)`);
    return lines[0].sku; // lines сужен до NonEmptyArray
}

function parse(raw: unknown): Record<string, unknown> {
    assertDefined(raw, 'тело запроса пустое');
    return isPlainObject(raw) ? raw : {};
}

type Status = 'active' | 'blocked';
function label(status: Status): string {
    switch (status) {
        case 'active':
            return 'активен';
        case 'blocked':
            return 'заблокирован';
        default:
            return assertNever(status); // новый вариант Status не скомпилируется
    }
}
```

## Команды

| Команда | Что делает |
|---|---|
| `nx lint core-js-utils` | ESLint с правилами воркспейса и границами модулей |
| `nx test core-js-utils` | Vitest: runtime и typecheck-прогон (`expectTypeOf`); `--coverage` проверяет порог 95% строк и веток |
| `nx test core-js-utils --testPathPattern=guards` | Приёмка E00.05.02 |
| `nx build core-js-utils` | Сборка `tsc` в `dist/` |
