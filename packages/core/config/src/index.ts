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
    ModuleConfig,
    ModuleSchema,
    TomlLayerResult,
} from './@types/index.js';
export { ConfigError } from './lib/config-error.js';
export { CONFIG_DIRECTORY, ConfigLoader, DEFAULT_LAYER_FILE, DOTENV_FILE, loadConfig } from './lib/config-loader.js';
export { defineModuleConfig, MODULES_SECTION, ModuleConfigToken } from './lib/define-module-config.js';
export { DotenvFile, mergeEnv } from './lib/dotenv.js';
export {
    coerceEnvValue,
    DEFAULT_ENV_PREFIX,
    ENV_SEPARATOR,
    EnvOverrides,
    envSegmentToKey,
    envVariableFor,
    keyToEnvSegment,
} from './lib/env-overrides.js';
export { ENVIRONMENT_VARIABLE, ENVIRONMENTS, isAppEnvironment, resolveEnvironment } from './lib/environment.js';
export { InjectModuleConfig } from './lib/inject-module-config.decorator.js';
export { deepFreeze, deepMerge, isConfigTree } from './lib/merge.js';
export { ConfigValidationError, loadModuleConfig, ModuleConfigReader } from './lib/module-config-reader.js';
export { ConfigModule, LOADED_CONFIG, MODULE_CONFIG_READER } from './lib/nest-config-module.js';
export {
    ConfigSecretError,
    DEFAULT_SECRET_POLICY,
    isSecretKey,
    maskSecrets,
    SECRET_KEY_WORDS,
    SECRET_MASK,
    SecretPolicy,
} from './lib/secrets.js';
export { parseToml } from './lib/toml.js';
export { TomlLayer } from './lib/toml-layer.js';
