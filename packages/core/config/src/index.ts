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
export { ENVIRONMENT_VARIABLE, ENVIRONMENTS, isAppEnvironment, resolveEnvironment } from './lib/environment.js';
export { deepFreeze, deepMerge, isConfigTree } from './lib/merge.js';
export { TomlLayer } from './lib/toml-layer.js';
