import { describe, expect, expectTypeOf, it } from 'vitest';

import { assertDefined, assertNever, InvariantError, invariant } from '../../src/index.js';

describe('invariant', () => {
    it('молчит на истинном условии и сужает тип', () => {
        const value: string | undefined = 'x' as string | undefined;
        invariant(value !== undefined);
        expectTypeOf(value).toEqualTypeOf<string>();
        expect(() => invariant(1)).not.toThrow();
    });

    it('бросает InvariantError с сообщением по умолчанию, строкой или ленивой функцией', () => {
        expect(() => invariant(false)).toThrow(InvariantError);
        expect(() => invariant(0)).toThrow('Нарушен инвариант');
        expect(() => invariant('', 'пустая строка')).toThrow('пустая строка');
        let calls = 0;
        const lazy = (): string => {
            calls += 1;
            return `ленивое ${calls}`;
        };
        invariant(true, lazy);
        expect(calls).toBe(0);
        expect(() => invariant(null, lazy)).toThrow('ленивое 1');
        const error = (() => {
            try {
                invariant(false, 'x');
            } catch (caught) {
                return caught as InvariantError;
            }
            return undefined;
        })();
        expect(error).toBeInstanceOf(Error);
        expect(error?.name).toBe('InvariantError');
    });
});

describe('assertNever', () => {
    type Status = 'active' | 'blocked';

    function label(status: Status): string {
        switch (status) {
            case 'active':
                return 'активен';
            case 'blocked':
                return 'заблокирован';
            default:
                return assertNever(status);
        }
    }

    it('делает switch исчерпывающим и сообщает неожиданное значение в рантайме', () => {
        expect(label('active')).toBe('активен');
        expect(() => label('deleted' as Status)).toThrow('Неожиданное значение: "deleted"');
        expect(() => assertNever(42 as never)).toThrow('Неожиданное значение: 42');
        expect(() => assertNever({ kind: 'x' } as never)).toThrow('Неожиданное значение: {"kind":"x"}');
        expect(() => assertNever(undefined as never)).toThrow('Неожиданное значение: undefined');
        expect(() => assertNever(null as never, 'своё сообщение')).toThrow('своё сообщение');
        // `return assertNever(status)` в функции `(): string` компилируется только потому, что результат — never.
        expectTypeOf(label).returns.toEqualTypeOf<string>();
    });

    it('не падает на несериализуемом объекте', () => {
        const cyclic: Record<string, unknown> = {};
        cyclic['self'] = cyclic;
        expect(() => assertNever(cyclic as never)).toThrow('Неожиданное значение: [object Object]');
    });
});

describe('assertDefined', () => {
    it('пропускает любые значения, кроме null и undefined, и сужает тип', () => {
        const value: number | null | undefined = 0 as number | null | undefined;
        assertDefined(value);
        expectTypeOf(value).toEqualTypeOf<number>();
        expect(() => assertDefined('')).not.toThrow();
        expect(() => assertDefined(false)).not.toThrow();
    });

    it('бросает InvariantError с указанием полученного значения или своим сообщением', () => {
        expect(() => assertDefined(null)).toThrow(InvariantError);
        expect(() => assertDefined(null)).toThrow('Ожидалось значение, получено null');
        expect(() => assertDefined(undefined)).toThrow('Ожидалось значение, получено undefined');
        expect(() => assertDefined(undefined, () => 'нет заказа')).toThrow('нет заказа');
    });
});
