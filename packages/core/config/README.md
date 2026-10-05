# @market/core-config

Загрузчик конфигурации: слои TOML (default, окружение, local), .env и переопределение переменными окружения

| | |
|---|---|
| Проект Nx | `core-config` |
| Каталог | `packages/core/config` |
| Теги | `scope:shared`, `type:core`, `platform:api` |
| Создан | `@market/tooling:lib` |

## Назначение

Загрузчик конфигурации: слои TOML (default, окружение, local), .env и переопределение переменными окружения

## Публичный API

Экспортируется только через `src/index.ts`, строго именованно:

- `configInfo(): ConfigInfo` — стартовая функция, заменить реальным API.
- `ConfigInfo` — тип результата (все типы пакета живут в `src/@types/index.ts`).

## Примеры

```ts
import { configInfo } from '@market/core-config';

configInfo(); // { name: 'config' }
```

## Команды

| Команда | Что делает |
|---|---|
| `nx lint core-config` | ESLint с правилами воркспейса и границами модулей |
| `nx test core-config` | Vitest, тесты из `test/`; `--coverage` проверяет порог 90% строк и веток |
| `nx build core-config` | Сборка `tsc` в `dist/` |
