# @market/tooling-lint-e2e

E2E-проверка раннера линтинга (`E00.02.07`): набор фикстур-нарушений для каждого правила из
`docs/epics/E00.02-lint-tooling.md` (пункт 3) и чистые образцы, которые раннер обязан пропустить.

| | |
|---|---|
| Проект Nx | `tooling-lint-e2e` |
| Каталог | `packages/tooling/lint-e2e` |
| Теги | `scope:shared`, `type:tooling`, `platform:api` |
| Создан | `@market/tooling:lib` |

## Как работает

Тест создаёт временный воркспейс в `tmp/`, записывает туда фикстуры, запускает настоящий CLI
`packages/tooling/lint/dist/cli/lint-run.js --ci --files ...` (конфиги `biome.json` и `eslint.config.mjs`
генерируются из реального `rules.toml`) и читает `.cache/lint/report.json`:

- каждая фикстура из `VIOLATION_FIXTURES` даёт ожидаемое правило (Biome `format`, `lint/style/useImportType`,
  `lint/suspicious/noExplicitAny`; ESLint `naming-convention`, `member-ordering`, `consistent-type-definitions`,
  `explicit-member-accessibility`, `explicit-function-return-type`, `typedef`, `no-restricted-syntax`,
  `no-restricted-imports`);
- `CLEAN_FIXTURES` проходят без замечаний (включая Material внутри `ui-web`);
- `--fix` исправляет форматирование и `import type`, повторный `--ci` даёт код 0; неизвестный аргумент — код 2.

Границы модулей проверяет `pnpm test:boundaries` (нужен граф проектов); правила Angular-шаблонов и i18n
появятся в фикстурах вместе с `angular-eslint` (E00.11).

## Команды

| Команда | Что делает |
|---|---|
| `nx e2e tooling-lint-e2e` | Приёмка E00.02.07 (собирает `tooling-lint`, затем прогоняет фикстуры) |
| `nx test tooling-lint-e2e` | То же через цель `test` |
