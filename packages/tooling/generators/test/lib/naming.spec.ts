import { describe, expect, it } from 'vitest';

import { assertKebabCase, buildTags } from '../../src/lib/naming';

describe('assertKebabCase', () => {
    it.each(['a', 'ts-utils', 'web-buyer2', 'x1-y2'])('принимает %s', (value) => {
        expect(() => assertKebabCase(value, 'name')).not.toThrow();
    });

    it.each(['', 'TsUtils', 'ts_utils', '-ts', 'ts-', 'ts--utils', '1ts', 'ts utils'])('отклоняет "%s"', (value) => {
        expect(() => assertKebabCase(value, 'name')).toThrow(/name должно быть в kebab-case/);
    });
});

describe('buildTags', () => {
    it('собирает теги в порядке scope, type, platform', () => {
        expect(buildTags({ scope: 'catalog', type: 'module', platform: 'web' })).toEqual([
            'scope:catalog',
            'type:module',
            'platform:web',
        ]);
    });
});
