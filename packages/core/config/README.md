# @market/core-config

Загрузчик конфигурации: слои TOML (default, окружение, local), .env и переопределение переменными окружения

| | |
|---|---|
| Проект Nx | `core-config` |
| Каталог | `packages/core/config` |
| Теги | `scope:shared`, `type:core`, `platform:api` |
| Создан | `@market/tooling:lib` |

## Назначение

Единый загрузчик конфигурации (эпик E00.03): несекретные настройки в TOML, секреты только в окружении.

Порядок слияния (каждый следующий слой сильнее предыдущего):

| Слой | Источник | Обязателен |
|---|---|---|
| `default` | `config/default.toml` | да |
| `<env>` | `config/dev.toml`, `test.toml`, `staging.toml`, `prod.toml` | нет |
| `local` | `config/local.toml` (в `.gitignore`, личные настройки разработчика) | нет |
| `dotenv` | `.env` (локальные секреты, в `.gitignore`; в `process.env` не экспортируется) | нет |
| `env` | переменные процесса `APP__…` (в проде секреты инъецируются из AWS Secrets Manager) | нет |

Окружение: `APP_ENV` (строго `dev`, `test`, `staging`, `prod`), иначе `NODE_ENV` (`development` → `dev`, `production` → `prod`), иначе `dev`.

### Переопределение окружением

`APP__MODULES__<NAME>__<KEY>=value` записывается в `modules.<name>.<key>`. Сегменты имени в `UPPER_SNAKE_CASE` переводятся в `camelCase` (`PAGE_SIZE` → `pageSize`), поэтому ключи в TOML пишутся в `camelCase`. Тип значения задаёт текущее значение из TOML: строка остаётся строкой, число и логическое значение разбираются строго (иначе ошибка). Если ключа в TOML нет, значение читается как литерал TOML (`20`, `true`, `["a", "b"]`, `"в кавычках"`), а если это не литерал — остаётся строкой.

Таблицы объединяются по ключам, скаляры, массивы и даты заменяются целиком. Небезопасные ключи (`__proto__`, `constructor`) отвергаются при разборе. Результат глубоко заморожен: конфиг неизменяем в рантайме.

## Публичный API

Экспортируется только через `src/index.ts`, строго именованно:

- `defineModuleConfig(name, schema)` → `ModuleConfigToken`: раздел `[modules.<name>]` (имя в `camelCase`) и его Zod-схема; `token.path` (`modules.<name>`), `token.envVariable(['pageSize'])` (`APP__MODULES__<NAME>__PAGE_SIZE`). Тип значений: `ModuleConfig<typeof TOKEN>`. Для защиты от опечаток в ключах используйте `z.strictObject`.
- `ModuleConfigReader` (`new ModuleConfigReader(loadedConfig).read(token)`) — по токену доступен только собственный раздел (нет раздела — пустая таблица, работают умолчания схемы); результат проверен схемой, заморожен и кэшируется по токену. `loadModuleConfig(token, options?)` — то же одним вызовом с загрузкой с диска.
- `ConfigValidationError` (наследует `ConfigError`, поле `module`) — раздел не прошёл схему: в каждой проблеме ключ, ожидаемый тип (сообщения Zod на русском) и для отсутствующего ключа подсказка, где его задать (TOML-ключ или переменная окружения).
- `ConfigLoader` (`new ConfigLoader(options).load()`), `loadConfig(options?)` — загрузка всех слоёв; возвращает `LoadedConfig` с `environment`, `envPrefix`, `tree` (итог), `fileTree` (только файлы TOML, нужно для запрета секретов в TOML) и `layers` (диагностика без значений).
- `ConfigLoaderOptions`: `configDir` (по умолчанию `<cwd>/config`), `dotenvPath` (`<cwd>/.env`, `null` отключает), `env` (`process.env`), `envPrefix` (`APP`), `environment`.
- `ConfigError` — ошибка с `issues: { source, path, message }[]`: какой файл или переменная, какой ключ, что ожидалось.
- `TomlLayer`, `DotenvFile`, `EnvOverrides`, `coerceEnvValue`, `envSegmentToKey`, `keyToEnvSegment`, `mergeEnv` — слои по отдельности.
- `resolveEnvironment`, `isAppEnvironment`, `ENVIRONMENTS`, `ENVIRONMENT_VARIABLE` — окружение.
- `deepMerge`, `deepFreeze`, `isConfigTree`, `parseToml` — примитивы слияния и разбора.
- Константы `CONFIG_DIRECTORY`, `DOTENV_FILE`, `DEFAULT_LAYER_FILE`, `DEFAULT_ENV_PREFIX`, `ENV_SEPARATOR`, `MODULES_SECTION`.
- Типы: `AppEnvironment`, `ConfigTree`, `ConfigValue`, `ConfigLayerInfo`, `ConfigLayerName`, `ConfigIssue`, `LoadedConfig`, `ModuleConfig`, `ModuleSchema`, `EnvRecord`, `EnvValues`, `EnvOverride`, `EnvOverridesResult`, `TomlLayerResult`.

Запрет секретов в TOML с маскированием и `ConfigModule.forModule(token)` для Nest добавляются задачами E00.03.03–E00.03.04.

## Примеры

```toml
# config/default.toml
[modules.catalog]
pageSize = 20
host = "db"
```

```bash
APP_ENV=staging
APP__MODULES__CATALOG__PAGE_SIZE=50          # modules.catalog.pageSize = 50 (число, как в TOML)
APP__MODULES__PAYMENTS__API_KEY=sk_live_…    # секрет: только окружение, в TOML запрещён
```

```ts
import { ConfigError, defineModuleConfig, loadConfig, loadModuleConfig, type ModuleConfig, ModuleConfigReader } from '@market/core-config';
import { z } from 'zod';

// modules/catalog/api: раздел модуля объявляется рядом с модулем
export const CATALOG_CONFIG = defineModuleConfig(
    'catalog',
    z.strictObject({ pageSize: z.number().int().positive(), host: z.string() }),
);
export type CatalogConfig = ModuleConfig<typeof CATALOG_CONFIG>; // Readonly<{ pageSize: number; host: string }>

// точка входа без Nest: один загруженный конфиг на процесс, по токену на модуль
try {
    const reader = new ModuleConfigReader(loadConfig());
    const catalog = reader.read(CATALOG_CONFIG); // { pageSize: 50, host: 'db' }, заморожен
    const payments = loadModuleConfig(PAYMENTS_CONFIG); // короткая форма: загрузка с диска и чтение одного раздела
} catch (error) {
    if (error instanceof ConfigError) {
        // Конфигурация модуля "catalog" не прошла валидацию:
        //   - modules.catalog → pageSize: Неверный ввод: ожидалось число, получено строка
        //   - modules.catalog → host: Неверный ввод: ожидалось строка, получено undefined
        //     (ключ "host" в [modules.catalog] или переменная APP__MODULES__CATALOG__HOST)
        console.error(error.message);
        process.exit(1);
    }
    throw error;
}
```

## Команды

| Команда | Что делает |
|---|---|
| `nx lint core-config` | ESLint с правилами воркспейса и границами модулей |
| `nx test core-config` | Vitest, тесты из `test/`; `--coverage` проверяет порог 90% строк и веток |
| `nx test core-config --testPathPattern=loader` | Приёмка E00.03.01: слои, порядок слияния, переопределения, диагностика |
| `nx test core-config --testPathPattern=define` | Приёмка E00.03.02: токены модулей, валидация Zod, изоляция разделов, ошибки старта |
| `nx build core-config` | Сборка `tsc` в `dist/` |
