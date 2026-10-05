import { type DynamicModule, Module, type Provider } from '@nestjs/common';

import type { ConfigLoaderOptions, LoadedConfig, ModuleConfig } from '../@types/index.js';
import { loadConfig } from './config-loader.js';
import type { ModuleConfigToken } from './define-module-config.js';
import { ModuleConfigReader } from './module-config-reader.js';

/** Ключ внедрения `LoadedConfig` (всё дерево; для логов применяйте `maskSecrets`). */
export const LOADED_CONFIG: unique symbol = Symbol('@market/core-config:LoadedConfig');

/** Ключ внедрения `ModuleConfigReader` приложения. */
export const MODULE_CONFIG_READER: unique symbol = Symbol('@market/core-config:ModuleConfigReader');

/**
 * Интеграция с Nest (E00.03, требование 5). `forRoot` подключается один раз в корневом модуле: конфиг
 * загружается при старте, ошибки загрузки и валидации (`ConfigError`) останавливают приложение с понятным
 * сообщением. `forModule` подключается в модуле фичи и даёт его раздел по токену.
 */
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: динамический модуль Nest — класс с @Module() и статическими forRoot/forModule
export class ConfigModule {
    /** Корневой модуль: один `LoadedConfig` и один `ModuleConfigReader` на приложение, доступны глобально. */
    public static forRoot(options: ConfigLoaderOptions = {}): DynamicModule {
        const providers: Provider[] = [
            { provide: LOADED_CONFIG, useFactory: (): LoadedConfig => loadConfig(options) },
            {
                inject: [LOADED_CONFIG],
                provide: MODULE_CONFIG_READER,
                useFactory: (config: LoadedConfig): ModuleConfigReader => new ModuleConfigReader(config),
            },
        ];
        return { exports: [LOADED_CONFIG, MODULE_CONFIG_READER], global: true, module: ConfigModule, providers };
    }

    /** Модуль фичи: провайдер раздела для каждого токена; раздел читается и проверяется при старте. */
    public static forModule(...tokens: readonly ModuleConfigToken[]): DynamicModule {
        const providers: Provider[] = tokens.map((token) => ({
            inject: [MODULE_CONFIG_READER],
            provide: token.injectionToken,
            useFactory: (reader: ModuleConfigReader): ModuleConfig<typeof token> => reader.read(token),
        }));
        return { exports: tokens.map((token) => token.injectionToken), module: ConfigModule, providers };
    }
}
