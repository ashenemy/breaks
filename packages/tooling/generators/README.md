# @market/tooling

Генераторы воркспейса. Каждый генератор **оборачивает** официальный плагин Nx и затем приводит
результат к структуре и правилам проекта (`docs/01-architecture.md`, раздел 4; `docs/02-code-conventions.md`;
ADR-0014). Проект, созданный не генератором, не имеет маркера в `project.json` и не проходит CI-проверку.

| | |
|---|---|
| Проект Nx | `tooling-generators` |
| Пакет | `@market/tooling` |
| Теги | `scope:shared`, `type:tooling`, `platform:api` |

## Генераторы

### `lib` — библиотека воркспейса

```bash
nx g @market/tooling:lib ts-utils --type=core
nx g @market/tooling:lib tokens --type=ui --directory=packages/design/tokens
nx g @market/tooling:lib catalog-api --type=module --platform=api --scope=catalog --directory=modules/catalog/api
```

Оборачивает `@nx/js:library` (tsc, Vitest, ESLint, `project.json`, TS project references) и добавляет:

- структуру `src/@types/index.ts` (все типы), `src/lib/` (реализация), `src/index.ts` (только именованные
  экспорты), `test/` (тесты зеркалят `src/lib`);
- три тега `scope:*`, `type:*`, `platform:*` и маркер `metadata.generator = "@market/tooling:lib"`;
- `README.md` модуля (назначение, публичный API, примеры, команды);
- Vitest без глобальных переменных, тесты из `test/`, порог покрытия 90% строк и веток;
- JSON-файлы проекта с отступом в четыре пробела.

| Опция | Обязательна | По умолчанию | Описание |
|---|---|---|---|
| `name` | да | — | Имя проекта в kebab-case |
| `type` | да | — | `core`, `contracts`, `ui`, `infra`, `tooling`, `module` |
| `platform` | нет | `shared` | `api`, `web`, `native`, `shared` |
| `scope` | нет | `shared` | Домен в kebab-case или `shared` |
| `directory` | для `module` | `packages/<type>/<name>` | Каталог проекта |
| `importPath` | нет | `@market/<name>` | Имя пакета для импорта |
| `description` | нет | `Пакет @market/<name>` | Для README и `project.json` |

Корневые `package.json` и `eslint.config.mjs` официальный генератор не меняет: зависимости воркспейса
фиксируются точными версиями отдельно (ADR-0002), а корневой конфиг ESLint управляется воркспейсом.

Сгенерированный проект сразу проходит `nx lint`, `nx test`, `nx build`, `nx typecheck`.

## Executors

### `vitest` — тесты с флагами в стиле Jest

Цель `test` каждого сгенерированного проекта использует `@market/tooling:vitest`, а не выведенную
`@nx/vitest`: приёмочные команды эпиков написаны в синтаксисе Jest (`--testPathPattern=schema`), который сам
Vitest отвергает. Executor переводит опции в аргументы Vitest и запускает `node_modules/vitest/vitest.mjs`
из каталога проекта.

```bash
nx test ts-utils                                  # vitest run
nx test ts-utils --testPathPattern=schema         # vitest run schema
nx test ts-utils --testNamePattern="возвращает"   # vitest run --testNamePattern ...
nx test ts-utils --coverage                       # покрытие с порогами из vitest.config.mts
nx test ts-utils -c ci                            # конфигурация ci: покрытие включено
nx test ts-utils --watch                          # vitest watch
```

Опции: `testPathPattern` (строка или список), `testNamePattern`, `coverage`, `watch`, `update`,
`passWithNoTests`, `bail`, `reporters`, `configFile`. Кэш, `inputs` и `dependsOn` цели приходят из
`targetDefaults.test` в `nx.json`.

## Публичный API

- `libGenerator(tree, options)` — точка входа генератора `lib`.
- `LibGenerator` — класс генератора (обёртка над `@nx/js:library` плюс пост-обработка).
- `vitestExecutor(options, context)`, `VitestRunner`, `buildVitestArgs` — executor Vitest и перевод опций.
- `buildVitestTestTarget`, `setVitestTestTarget` — цель `test` на executor-е воркспейса.
- `normalizeLibOptions`, `buildTags`, `assertKebabCase` — проверка опций и сборка тегов.
- `markGeneratedProject`, `readGeneratedProjectMetadata` — маркер генератора в `project.json`.
- Константы `GENERATOR_COLLECTION`, `LIB_GENERATOR`, `VITEST_EXECUTOR`, `LIB_TYPES`, `PLATFORMS`, `COVERAGE_THRESHOLD`.
- Типы `LibGeneratorSchema`, `NormalizedLibOptions`, `VitestExecutorSchema`, `LibType`, `Platform`, `ProjectTags`.

## Команды

| Команда | Что делает |
|---|---|
| `nx test tooling-generators` | Тесты генераторов и executor-ов (приёмка E00.01.03); `--testPathPattern=<фильтр>` сужает запуск |
| `nx test tooling-generators -c ci` | То же с покрытием и порогом 90% |
| `nx lint tooling-generators` | ESLint, включая проверки `generators.json`, `executors.json` и `package.json` плагина |
| `nx build tooling-generators` | Сборка плагина в `dist/` (для запуска генераторов не требуется: Nx читает исходники) |

## Дальше

Генераторы `nest-app`, `angular-app`, `nativescript-app` и `module` добавляются подзадачами E00.01.03b–e.
