import { describe, expect, it } from 'vitest';

import { deriveProjectName, normalizeLibOptions } from '../../src/lib/normalize-lib-options';

describe('deriveProjectName', () => {
    it.each([
        ['packages/core/ts-utils', 'core-ts-utils'],
        ['packages/tooling/lint', 'tooling-lint'],
        ['packages/design/tokens', 'design-tokens'],
        ['packages/ui/ui-web', 'ui-web'],
        ['packages/ui/ui-contracts', 'ui-contracts'],
        ['modules/catalog/api', 'catalog-api'],
        ['modules/i18n/web', 'i18n-web'],
        ['apps/web-buyer', 'web-buyer'],
        ['apps/api', 'api'],
    ])('%s → %s', (directory, expected) => {
        expect(deriveProjectName(directory)).toBe(expected);
    });
});

describe('normalizeLibOptions', () => {
    it('вычисляет имена, каталог, import path и теги по умолчанию', () => {
        expect(normalizeLibOptions({ name: 'js-utils', type: 'core' })).toEqual({
            className: 'JsUtils',
            description: 'Пакет @market/core-js-utils',
            directory: 'packages/core/js-utils',
            fileName: 'js-utils',
            importPath: '@market/core-js-utils',
            name: 'js-utils',
            platform: 'shared',
            projectName: 'core-js-utils',
            propertyName: 'jsUtils',
            scope: 'shared',
            skipFormat: false,
            tags: ['scope:shared', 'type:core', 'platform:shared'],
            type: 'core',
        });
    });

    it('нормализует явный каталог к виду без ведущих и завершающих слэшей', () => {
        expect(
            normalizeLibOptions({ name: 'mongo', type: 'infra', directory: './packages\\infra\\mongo/' }).directory,
        ).toBe('packages/infra/mongo');
    });

    it('обрезает пробелы в имени и описании', () => {
        const options = normalizeLibOptions({ name: ' tokens ', type: 'ui', description: '  Токены  ' });
        expect(options.name).toBe('tokens');
        expect(options.description).toBe('Токены');
    });

    it('требует каталог для доменных модулей', () => {
        expect(() => normalizeLibOptions({ name: 'catalog-api', type: 'module' })).toThrow(/directory/);
        expect(
            normalizeLibOptions({ name: 'catalog-api', type: 'module', directory: 'modules/catalog/api' }).directory,
        ).toBe('modules/catalog/api');
    });

    it('проверяет имя, тип, платформу и scope', () => {
        expect(() => normalizeLibOptions({ name: 'Bad Name', type: 'core' })).toThrow(/name должно быть в kebab-case/);
        expect(() => normalizeLibOptions({ type: 'core' } as never)).toThrow(/name должно быть в kebab-case/);
        expect(() => normalizeLibOptions({ name: 'ok', type: 'unknown' as 'core' })).toThrow(
            /type должно быть одним из/,
        );
        expect(() => normalizeLibOptions({ name: 'ok', type: 'core', platform: 'ios' as 'api' })).toThrow(
            /platform должно быть одним из/,
        );
        expect(() => normalizeLibOptions({ name: 'ok', type: 'core', scope: 'my_scope' })).toThrow(
            /scope должно быть в kebab-case/,
        );
    });
});
