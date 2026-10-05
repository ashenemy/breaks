import { describe, expect, it } from 'vitest';

import {
    ConfigError,
    ENVIRONMENT_VARIABLE,
    ENVIRONMENTS,
    isAppEnvironment,
    resolveEnvironment,
} from '../../src/index.js';

describe('resolveEnvironment', () => {
    it('берёт APP_ENV, если он задан одним из допустимых значений', () => {
        for (const environment of ENVIRONMENTS) {
            expect(resolveEnvironment({ APP_ENV: environment, NODE_ENV: 'production' })).toBe(environment);
        }
    });

    it('падает с ConfigError на неизвестном APP_ENV и называет переменную', () => {
        expect(() => resolveEnvironment({ APP_ENV: 'qa' })).toThrow(ConfigError);
        try {
            resolveEnvironment({ APP_ENV: 'qa' });
        } catch (error) {
            const { issues, message } = error as ConfigError;
            expect(issues).toEqual([
                { message: 'ожидается одно из: dev, test, staging, prod; получено "qa"', path: '', source: 'APP_ENV' },
            ]);
            expect(message).toContain(ENVIRONMENT_VARIABLE);
            expect(message).toContain('"qa"');
        }
    });

    it('без APP_ENV понимает NODE_ENV, а неизвестное значение и пустоту сводит к dev', () => {
        expect(resolveEnvironment({ NODE_ENV: 'development' })).toBe('dev');
        expect(resolveEnvironment({ NODE_ENV: 'production' })).toBe('prod');
        expect(resolveEnvironment({ NODE_ENV: 'test' })).toBe('test');
        expect(resolveEnvironment({ NODE_ENV: 'staging' })).toBe('staging');
        expect(resolveEnvironment({ NODE_ENV: 'prod' })).toBe('prod');
        expect(resolveEnvironment({ NODE_ENV: 'whatever' })).toBe('dev');
        expect(resolveEnvironment({ APP_ENV: '', NODE_ENV: 'production' })).toBe('prod');
        expect(resolveEnvironment({})).toBe('dev');
    });
});

describe('isAppEnvironment', () => {
    it('принимает только четыре окружения', () => {
        expect(isAppEnvironment('dev')).toBe(true);
        expect(isAppEnvironment('prod')).toBe(true);
        expect(isAppEnvironment('production')).toBe(false);
        expect(isAppEnvironment(1)).toBe(false);
    });
});
