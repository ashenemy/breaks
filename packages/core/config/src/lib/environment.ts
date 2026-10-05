import type { AppEnvironment, EnvRecord } from '../@types/index.js';
import { ConfigError } from './config-error.js';

/** Допустимые окружения в порядке «от разработки к продакшену». */
export const ENVIRONMENTS: readonly AppEnvironment[] = ['dev', 'test', 'staging', 'prod'];

/** Переменная, явно задающая окружение. */
export const ENVIRONMENT_VARIABLE = 'APP_ENV';

/** Значения `NODE_ENV`, которые понимаются как окружение, если `APP_ENV` не задан. */
const NODE_ENV_ALIASES: Readonly<Record<string, AppEnvironment>> = {
    dev: 'dev',
    development: 'dev',
    prod: 'prod',
    production: 'prod',
    staging: 'staging',
    test: 'test',
};

export function isAppEnvironment(value: unknown): value is AppEnvironment {
    return typeof value === 'string' && (ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Окружение: `APP_ENV` (строго одно из `ENVIRONMENTS`, иначе ошибка), затем `NODE_ENV`
 * (`development` → `dev`, `production` → `prod`; неизвестное значение игнорируется), иначе `dev`.
 */
export function resolveEnvironment(env: EnvRecord): AppEnvironment {
    const explicit = env[ENVIRONMENT_VARIABLE];
    if (explicit !== undefined && explicit !== '') {
        if (isAppEnvironment(explicit)) {
            return explicit;
        }
        throw new ConfigError([
            {
                message: `ожидается одно из: ${ENVIRONMENTS.join(', ')}; получено "${explicit}"`,
                path: '',
                source: ENVIRONMENT_VARIABLE,
            },
        ]);
    }
    const nodeEnv = env['NODE_ENV'];
    return (nodeEnv === undefined ? undefined : NODE_ENV_ALIASES[nodeEnv]) ?? 'dev';
}
