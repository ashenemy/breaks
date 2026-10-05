import { describe, expect, it } from 'vitest';

import type { ConfigTree } from '../../src/index.js';
import { deepFreeze, deepMerge, isConfigTree } from '../../src/index.js';

describe('isConfigTree', () => {
    it('различает таблицу и остальные значения TOML', () => {
        expect(isConfigTree({})).toBe(true);
        expect(isConfigTree({ a: 1 })).toBe(true);
        expect(isConfigTree([])).toBe(false);
        expect(isConfigTree(new Date(0))).toBe(false);
        expect(isConfigTree(null)).toBe(false);
        expect(isConfigTree('text')).toBe(false);
        expect(isConfigTree(42)).toBe(false);
    });
});

describe('deepMerge', () => {
    it('объединяет вложенные таблицы и заменяет скаляры значением из source', () => {
        const target: ConfigTree = { modules: { catalog: { pageSize: 20, host: 'a' }, mail: { from: 'x' } } };
        const source: ConfigTree = { modules: { catalog: { pageSize: 50 } } };
        expect(deepMerge(target, source)).toEqual({
            modules: { catalog: { pageSize: 50, host: 'a' }, mail: { from: 'x' } },
        });
    });

    it('заменяет массивы и даты целиком, не склеивая', () => {
        const later = new Date('2026-10-05T00:00:00Z');
        const merged = deepMerge(
            { list: [1, 2, 3], when: new Date(0), nested: { list: ['a'] } },
            { list: [9], when: later, nested: { list: [] } },
        );
        expect(merged).toEqual({ list: [9], when: later, nested: { list: [] } });
    });

    it('таблица из source замещает скаляр или массив из target и наоборот', () => {
        expect(deepMerge({ a: 1, b: { x: 1 } }, { a: { y: 2 }, b: 'flat' })).toEqual({ a: { y: 2 }, b: 'flat' });
    });

    it('не изменяет входные деревья и не разделяет вложенные таблицы с ними', () => {
        const target: ConfigTree = { modules: { catalog: { pageSize: 20 } } };
        const source: ConfigTree = { modules: { mail: { from: 'x' } }, extra: { flag: true } };
        const merged = deepMerge(target, source);
        expect(target).toEqual({ modules: { catalog: { pageSize: 20 } } });
        expect(source).toEqual({ modules: { mail: { from: 'x' } }, extra: { flag: true } });
        expect(merged['modules']).not.toBe(target['modules']);
        expect(merged['extra']).not.toBe(source['extra']);
    });
});

describe('deepFreeze', () => {
    it('замораживает дерево рекурсивно, включая массивы, и возвращает тот же объект', () => {
        const tree: ConfigTree = { a: { b: [1, { c: 2 }] }, d: 'x' };
        const frozen = deepFreeze(tree);
        expect(frozen).toBe(tree);
        expect(Object.isFrozen(tree)).toBe(true);
        expect(Object.isFrozen(tree['a'])).toBe(true);
        const list = (tree['a'] as ConfigTree)['b'] as unknown[];
        expect(Object.isFrozen(list)).toBe(true);
        expect(Object.isFrozen(list[1])).toBe(true);
        expect(() => {
            (tree['a'] as ConfigTree)['new'] = 1;
        }).toThrow(TypeError);
    });

    it('пропускает скаляры, null и уже замороженные объекты', () => {
        expect(deepFreeze(5)).toBe(5);
        expect(deepFreeze(null)).toBeNull();
        const inner = { x: 1 };
        const outer = Object.freeze({ inner });
        deepFreeze(outer);
        expect(Object.isFrozen(inner)).toBe(false);
    });
});
