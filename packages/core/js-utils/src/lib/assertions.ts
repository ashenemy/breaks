import type { AssertionMessage } from '../@types/index.js';

/** Нарушение инварианта: ошибка программиста или данных, а не ожидаемая ситуация. */
export class InvariantError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvariantError';
    }
}

/** Разворачивает сообщение, заданное строкой или ленивой функцией (чтобы не собирать строку на горячем пути). */
function resolveMessage(message: AssertionMessage | undefined, fallback: string): string {
    if (message === undefined) {
        return fallback;
    }
    return typeof message === 'function' ? message() : message;
}

/** Бросает `InvariantError`, если условие ложно; сужает тип условия для компилятора. */
export function invariant(condition: unknown, message?: AssertionMessage): asserts condition {
    if (!condition) {
        throw new InvariantError(resolveMessage(message, 'Нарушен инвариант'));
    }
}

/** Исчерпывающий `switch`: компилятор не пропустит новый вариант, а в рантайме сообщается неожиданное значение. */
export function assertNever(value: never, message?: AssertionMessage): never {
    throw new InvariantError(resolveMessage(message, `Неожиданное значение: ${describe(value)}`));
}

/** Утверждает, что значение не `null` и не `undefined`. */
export function assertDefined<T>(value: T, message?: AssertionMessage): asserts value is NonNullable<T> {
    if (value === null || value === undefined) {
        throw new InvariantError(resolveMessage(message, `Ожидалось значение, получено ${String(value)}`));
    }
}

function describe(value: unknown): string {
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (typeof value === 'object' && value !== null) {
        try {
            return JSON.stringify(value);
        } catch {
            return Object.prototype.toString.call(value);
        }
    }
    return String(value);
}
