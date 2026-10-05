/**
 * Все типы пакета @market/core-js-utils: внутренние и публичные (02-code-conventions.md, раздел 1).
 * Публичные типы реэкспортируются через src/index.ts в форме `export type`.
 */
/** Предикат-сужение типа. */
export type TypeGuard<T> = (value: unknown) => value is T;
/** Сообщение утверждения: строка или ленивая функция, чтобы не собирать строку на горячем пути. */
export type AssertionMessage = string | (() => string);
/** Объект, созданный литералом или `Object.create(null)`: ключи-строки, значения неизвестны. */
export type PlainObject = Record<string, unknown>;
