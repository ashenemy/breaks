import { join } from 'node:path';

import type {
    AppEnvironment,
    ConfigLayerInfo,
    ConfigLayerName,
    ConfigLoaderOptions,
    ConfigTree,
    EnvRecord,
    EnvValues,
    LoadedConfig,
} from '../@types/index.js';
import { ConfigError } from './config-error.js';
import { DotenvFile, mergeEnv } from './dotenv.js';
import { DEFAULT_ENV_PREFIX, EnvOverrides } from './env-overrides.js';
import { resolveEnvironment } from './environment.js';
import { deepFreeze, deepMerge } from './merge.js';
import { TomlLayer } from './toml-layer.js';

/** Каталог конфигов относительно рабочего каталога процесса. */
export const CONFIG_DIRECTORY = 'config';

/** Файл локальных секретов относительно рабочего каталога процесса. */
export const DOTENV_FILE = '.env';

/** Единственный обязательный слой: без него приложению нечего загружать. */
export const DEFAULT_LAYER_FILE = 'default.toml';

/**
 * Загрузчик конфигурации (E00.03, требование 1): `default.toml` → `<env>.toml` → `local.toml`, затем
 * переменные окружения (`.env` слабее переменных процесса). Результат заморожен: конфиг неизменяем в рантайме.
 */
export class ConfigLoader {
    private readonly __configDir: string;

    private readonly __dotenvPath: string | null;

    private readonly __env: EnvRecord;

    private readonly __environment: AppEnvironment | undefined;

    private readonly __envPrefix: string;

    private readonly __overrides: EnvOverrides;

    constructor(options: ConfigLoaderOptions = {}) {
        const cwd = process.cwd();
        this.__configDir = options.configDir ?? join(cwd, CONFIG_DIRECTORY);
        this.__dotenvPath = options.dotenvPath === undefined ? join(cwd, DOTENV_FILE) : options.dotenvPath;
        this.__env = options.env ?? process.env;
        this.__environment = options.environment;
        this.__envPrefix = options.envPrefix ?? DEFAULT_ENV_PREFIX;
        this.__overrides = new EnvOverrides(this.__envPrefix);
    }

    public get configDir(): string {
        return this.__configDir;
    }

    public get dotenvPath(): string | null {
        return this.__dotenvPath;
    }

    /** Путь файла слоя `<name>.toml` в каталоге конфигов. */
    public layerPath(name: ConfigLayerName): string {
        return join(this.__configDir, `${name}.toml`);
    }

    public load(): LoadedConfig {
        const dotenv = this.__dotenvPath === null ? null : new DotenvFile(this.__dotenvPath);
        const env = this.__readEnv(dotenv);
        const environment = this.__environment ?? resolveEnvironment(env);

        const layers: ConfigLayerInfo[] = [];
        let fileTree: ConfigTree = {};
        for (const layer of this.__fileLayers(environment)) {
            const { info, tree } = layer.load();
            if (layer.name === 'default' && !info.present) {
                throw new ConfigError([
                    {
                        message: `файл обязателен: создайте ${DEFAULT_LAYER_FILE} в каталоге ${this.__configDir}`,
                        path: '',
                        source: layer.filePath,
                    },
                ]);
            }
            layers.push(info);
            fileTree = deepMerge(fileTree, tree);
        }

        if (dotenv !== null) {
            layers.push(dotenv.info());
        }
        const overrides = this.__overrides.apply(fileTree, env);
        layers.push({
            name: 'env',
            present: overrides.variables.length > 0,
            source: `${this.__overrides.prefix}*`,
            variables: overrides.variables,
        });

        return {
            environment,
            envPrefix: this.__envPrefix,
            fileTree: deepFreeze(fileTree),
            layers,
            tree: deepFreeze(overrides.tree),
        };
    }

    private __fileLayers(environment: AppEnvironment): TomlLayer[] {
        const names: readonly ConfigLayerName[] = ['default', environment, 'local'];
        return names.map((name) => new TomlLayer(name, this.layerPath(name)));
    }

    private __readEnv(dotenv: DotenvFile | null): EnvValues {
        return mergeEnv(dotenv === null ? {} : dotenv.read(), this.__env);
    }
}

/** Загружает конфигурацию с умолчаниями `ConfigLoader` (не-Nest код; для Nest см. E00.03.04). */
export function loadConfig(options?: ConfigLoaderOptions): LoadedConfig {
    return new ConfigLoader(options).load();
}
