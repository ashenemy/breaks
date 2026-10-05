import { describe, expect, it } from 'vitest';

import { buildVitestArgs } from '../../src/lib/vitest-args';

describe('buildVitestArgs', () => {
    it('по умолчанию запускает однократный прогон', () => {
        expect(buildVitestArgs({})).toEqual(['run']);
    });

    it('переводит --testPathPattern в позиционные фильтры файлов', () => {
        expect(buildVitestArgs({ testPathPattern: 'schema' })).toEqual(['run', 'schema']);
        expect(buildVitestArgs({ testPathPattern: ['schema', ' runner ', ''] })).toEqual(['run', 'schema', 'runner']);
    });

    it('передаёт остальные опции флагами Vitest', () => {
        expect(
            buildVitestArgs({
                bail: 2,
                configFile: 'vitest.config.mts',
                coverage: true,
                passWithNoTests: true,
                reporters: ['default', 'junit'],
                testNamePattern: 'возвращает',
                update: true,
                watch: true,
            }),
        ).toEqual([
            'watch',
            '--testNamePattern',
            'возвращает',
            '--coverage',
            '--update',
            '--passWithNoTests',
            '--bail',
            '2',
            '--reporter',
            'default',
            '--reporter',
            'junit',
            '--config',
            'vitest.config.mts',
        ]);
    });

    it('игнорирует bail без значения и ложные флаги', () => {
        expect(buildVitestArgs({ bail: 0, coverage: false, update: false, watch: false })).toEqual(['run']);
    });
});
