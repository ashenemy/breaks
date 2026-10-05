# @market/tooling-lint

Правила кода воркспейса в одном ручном источнике — `rules.toml` — и инструменты вокруг него:
схема и загрузчик (E00.02.01), генераторы `biome.json` и `eslint.config.mjs` (E00.02.02–03), раннер
`lint:run` (E00.02.04), хуки и валидатор коммитов (E00.02.05–06).

| | |
|---|---|
| Проект Nx | `tooling-lint` |
| Каталог | `packages/tooling/lint` |
| Теги | `scope:shared`, `type:tooling`, `platform:api` |
| Создан | `@market/tooling:lib` |

## Назначение

`rules.toml` описывает намерение из `docs/02-code-conventions.md`: форматирование, именование, порядок членов
класса, импорты и экспорты, типы, правила Angular и i18n, границы модулей (ADR-0014), формат коммитов и
распределение пересекающихся правил между Biome и ESLint. Схема Zod (`RULES_SCHEMA`) валидирует файл,
подставляет умолчания конвенций и отклоняет неизвестные ключи; типы выводятся из схемы.

Разделы: `[format]`, `[naming]`, `[members]`, `[imports]`, `[types]`, `[angular]`, `[i18n]`,
`[boundaries]` (обязателен), `[commits]` (обязателен), `[overlap]`, `[platforms.<api|web|native|shared>]`
(частичные переопределения `format`, `naming`, `members`, `imports`, `types`).

## Публичный API

- `loadRules(filePath?)` → `{ config, filePath }` — читает и валидирует TOML (по умолчанию `rules.toml` пакета).
- `parseRules(toml, filePath?)` — разбирает текст TOML.
- `RulesLoader` — класс загрузчика; `RulesConfigError` — ошибка с `issues: { path, message }[]`.
- `RULES_SCHEMA`, `overrideOf(section)` — схема и построение переопределений по платформе.
- `DEFAULT_RULES_PATH` — путь к `rules.toml`.
- Типы: `RulesConfig`, `RawRules`, `FormatRules`, `NamingRules`, `MembersRules`, `ImportsRules`, `TypesRules`,
  `AngularRules`, `I18nRules`, `BoundariesRules`, `BoundaryConstraint`, `CommitsRules`, `OverlapRules`,
  `PlatformOverrides`, `RulesIssue`, `LoadedRules`.

## Примеры

```ts
import { loadRules, RulesConfigError } from '@market/tooling-lint';

try {
    const { config } = loadRules();
    config.format.indent; // 4
    config.boundaries.constraints[0]; // { source: 'platform:api', only: ['platform:api', 'platform:shared'] }
} catch (error) {
    if (error instanceof RulesConfigError) {
        console.error(error.message); // Некорректный .../rules.toml:\n  - format.indent: ...
    }
}
```

## Команды

| Команда | Что делает |
|---|---|
| `nx test tooling-lint` | Тесты; `--testPathPattern=schema` — только схема (приёмка E00.02.01) |
| `nx test tooling-lint -c ci` | Тесты с покрытием и порогом 90% |
| `nx lint tooling-lint` | ESLint |
| `nx build tooling-lint` | Сборка `tsc` в `dist/` |
