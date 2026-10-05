export type {
    AppEnvironment,
    ConfigIssue,
    ConfigLayerInfo,
    ConfigLayerName,
    ConfigLoaderOptions,
    ConfigTree,
    ConfigValue,
    EnvOverride,
    EnvOverridesResult,
    EnvRecord,
    EnvValues,
    LoadedConfig,
    TomlLayerResult,
} from './@types/index.js';
export { ConfigError } from './lib/config-error.js';
export { DotenvFile, mergeEnv } from './lib/dotenv.js';
export {
    coerceEnvValue,
    DEFAULT_ENV_PREFIX,
    ENV_SEPARATOR,
    EnvOverrides,
    envSegmentToKey,
} from './lib/env-overrides.js';
export { ENVIRONMENT_VARIABLE, ENVIRONMENTS, isAppEnvironment, resolveEnvironment } from './lib/environment.js';
export { deepFreeze, deepMerge, isConfigTree } from './lib/merge.js';
export { parseToml } from './lib/toml.js';
export { TomlLayer } from './lib/toml-layer.js';
