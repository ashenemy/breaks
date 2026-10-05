# Ручной журнал прогресса

Ведётся до готовности инструмента `tooling/progress` (E00.10). После него источником истины становятся `plan.yaml` и `state.yaml`, а этот файл архивируется.

Формат статуса: `todo`, `in_progress`, `done`, `blocked`. Статус `done` ставится только после успешного прохождения всех команд `acceptance` задачи.

## Текущая задача

| Поле | Значение |
|---|---|
| Задача | E00.05.02 — `core/js-utils`: проверки типов и утверждения (см. `docs/epics/E00.05-utils.md`) |
| Ветка | `autopilot/E00.05.02` |
| Подшаги | 1 ⏳ каркас `core-js-utils` (`--type=core`, зависимость `@market/core-ts-utils` для `NonEmptyArray`), `src/lib/guards.ts`: `isString`, `isNumber` (без NaN), `isBoolean`, `isBigInt`, `isSymbol`, `isFunction`, `isArray`, `isDate` (валидная), `isObject`, `isPlainObject`, `isNil`, `isNonEmptyString`, `isNonEmptyArray`, `isUuid`, `isObjectId`; тесты `test/lib/guards.spec.ts`; 2 `src/lib/assertions.ts`: `invariant` (+ `InvariantError`), `assertNever`, `assertDefined`; тесты, порог покрытия 95%, README, журнал |
| Следующее действие | Подшаг 1: генератор, guards и тесты. Приёмка `nx test core-js-utils --testPathPattern=guards`. Окружение: WSL 3.0.1 и Docker Desktop 4.93.0 установлены, компонент «Платформа виртуальной машины» ждёт перезагрузки Windows — после неё проверить `docker info` и перейти к E00.04 |

## Разбиение задач (`progress split`)

E00.01.03 (вес 5) разбита по протоколу (размер больше ~400 строк, разные плагины Nx и фиксация версий платформ). Приёмка каждой подзадачи: `nx test tooling-generators`. Зависимые задачи E00.01.04 и E00.02.01 требуют только генератор `lib`, поэтому их зависимость переносится на E00.01.03a.

| Подзадача | Содержание | Scope | Вес | Зависимости |
|---|---|---|---|---|
| E00.01.03a | Плагин `tooling-generators` (`@market/tooling`), генератор `lib` над `@nx/js:library`: структура, теги, README, маркер, Vitest с порогом покрытия | `packages/tooling/generators` | 2 | E00.01.02 |
| E00.01.03b | Генератор `nest-app` над `@nx/nest:application`; NestJS в ADR-0002 | `packages/tooling/generators` | 1 | E00.01.03a |
| E00.01.03c | Генератор `angular-app` над `@nx/angular:application` (SSR); Angular и Tailwind в ADR-0002 | `packages/tooling/generators` | 1 | E00.01.03a |
| E00.01.03d | Генератор `nativescript-app` над `@nativescript/nx:app`; NativeScript в ADR-0002 | `packages/tooling/generators` | 1 | E00.01.03a |
| E00.01.03e | Генератор `module`: `modules/<name>/{api,web,native}` по выбору платформ и контрактный пакет | `packages/tooling/generators` | 1 | E00.01.03b, E00.01.03c, E00.01.03d |
| E00.01.03f | Executor `vitest`: приёмочные команды эпиков используют Jest-флаг `--testPathPattern`, который Vitest отвергает; генератор `lib` ставит executor целью `test` (A-014) | `packages/tooling/generators` | 1 | E00.01.03a |

Зависимость E00.02.01 (первая приёмка с `--testPathPattern`) переносится на E00.01.03f.

## Журнал задач

| Задача | Статус | Коммит | Примечание |
|---|---|---|---|
| E00.01.01 | done | `ecd8518` | Приёмка: `nx graph --file=tmp/graph.json`, `nx run-many -t build --all --skip-nx-cache` — код 0. Допущения A-008, A-009; ADR-0002 |
| E00.01.02 | done | `2be266b` | Приёмка: `pnpm test:boundaries` — 28 тестов, код 0; `nx run-many -t lint test build` — код 0. ADR-0014, допущение A-010 |
| E00.01.03a | done | `84e523a` | Приёмка: `nx test tooling-generators` — 57 тестов, код 0; покрытие 100% строк, 97,8% веток; `nx run-many -t typecheck build lint test --all` — код 0. Сценарий `nx g @market/tooling:lib` проверен вживую. Допущения A-011, A-012, A-013 |
| E00.01.03b | todo | — | — |
| E00.01.03c | todo | — | — |
| E00.01.03d | todo | — | — |
| E00.01.03e | todo | — | — |
| E00.01.03f | done | `9b9e330` | Приёмка: `nx test tooling-generators` — 66 тестов, код 0 (через сам executor); `nx test tooling-generators --testPathPattern=executors` и `-c ci` (покрытие 100% строк, 97,4% веток) — код 0. Допущение A-014 |
| E00.01.04 | done | `e6888e2` | Приёмка: `nx affected -t lint test build --base=HEAD~1` — код 0; `pnpm check:generated`, `pnpm test:tools` (45 тестов) — код 0. README корня: раздел «Работа с репозиторием» |
| E00.02.01 | done | `433eea0` | Приёмка: `nx test tooling-lint --testPathPattern=schema` — код 0 (13 тестов всего, покрытие 100%/90%+). Имена проектов по соглашению эпиков (`tooling-lint`, `core-ts-utils`) заложены в генератор (`53dbd02`) |
| E00.02.02 | done | `36863fc` | Приёмка: `nx test tooling-lint --testPathPattern=biome-generator` — 10 тестов, код 0 (в том числе проверка конфига установленным Biome 2.5.15). Хеш-кэш `.cache/lint/hash` |
| E00.02.03 | done | `04c9a85` | Приёмка: `nx test tooling-lint --testPathPattern=eslint-generator` — 19 тестов, код 0 (проверка настоящим ESLint 10). Корневой `eslint.config.mjs` генерируется из TOML, `[boundaries]` заменил `tools/boundaries/dep-constraints.mjs` |
| E00.02.04 | done | `76e6ac5` | Приёмка: `nx test tooling-lint --testPathPattern=runner` — 9 тестов, код 0. `nx run tooling-lint:run` (`pnpm lint:run`, `lint:fix`): режимы `--staged/--affected/--fix/--ci/--format-only`, кэш чистых файлов, отчёт `.cache/lint/report.json`. Весь воркспейс отформатирован Biome |
| E00.02.05 | done | `1d2b1f0` | Приёмка: `--testPathPattern=hooks` — 5 тестов, код 0. `.githooks/` (pre-commit, commit-msg, pre-push), `core.hooksPath` и генерация конфигов на `postinstall` (`nx run tooling-lint:postinstall`), `eslint.config.mjs` больше не в git |
| E00.02.06 | done | `978d494` | Приёмка: `--testPathPattern=commit-msg` — 11 тестов, код 0. Валидатор: формат, пара иконка-тип, трейлеры Task/Substep, один проект Nx по staged-файлам; коммиты раздела прошли через него |
| E00.02.07 | done | `b83d0cb` | Приёмка: `nx e2e tooling-lint-e2e` — 23 теста, код 0: фикстура на каждое правило §3, чистые образцы, `--fix`, коды возврата |
| E00.03.01 | done | `6eba361` | Приёмка: `nx test core-config --testPathPattern=loader` — 9 тестов, код 0; всего 43 теста, покрытие 100% строк, 98% веток; `nx affected -t lint typecheck test build --base=main` — код 0. Пакет `core-config` (`packages/core/config`, теги `scope:shared`, `type:core`, `platform:api`): `ConfigLoader`/`loadConfig`, слои default → `<env>` → local → `.env` → `APP__*`, `ConfigError` с источником и путём, деревья заморожены. Допущения A-018..A-021; `config/local.toml` в `.gitignore`. Замечание для `tooling-generators`: `@nx/js:library` переформатирует `nx.json` и дописывает `targetDefaults["@nx/eslint:lint"]` — откачено вручную, стоит защитить `nx.json` как `package.json` (A-013) |
| E00.03.02 | done | `9ef018f` | Приёмка: `nx test core-config --testPathPattern=define` — 11 тестов, код 0; всего 54 теста, покрытие 100% строк, 97% веток; affected — код 0. `defineModuleConfig(name, schema)` → `ModuleConfigToken` (`path`, `envVariable`), `ModuleConfigReader.read(token)` читает только `modules.<name>`, валидирует Zod (локаль `ru` на разбор), замораживает и кэширует; `ConfigValidationError` с модулем, ключом, ожидаемым типом и подсказкой для отсутствующего ключа; `loadModuleConfig`; тест изоляции разделов. `zod` 4.6.5 в пакете. Допущение A-022 |
| E00.03.03 | done | `06a07ef` | Приёмка: `nx test core-config --testPathPattern=secrets` — 10 тестов, код 0; всего 64 теста, покрытие 100% строк, 98% веток; affected — код 0. `SecretPolicy` (последнее слово ключа из `secret`/`password`/`token`/`key`), проверка каждого слоя TOML в `ConfigLoader.load()` → `ConfigSecretError` с файлом, путём и именем переменной без значения; `maskSecrets` для логов и ответов API; опция `secrets`. Допущение A-023 |
| E00.03.04 | done | `bf0e6e0` | Приёмка: `nx test core-config --testPathPattern=nest` — 4 теста в реальном DI-контейнере Nest, код 0; всего 68 тестов; affected по 4 проектам, `nx e2e tooling-lint-e2e` (23), `pnpm lint:run --ci`, `check:generated`, `test:tools` — код 0. `ConfigModule.forRoot`/`forModule`, `InjectModuleConfig` (`*.decorator.ts`), `LOADED_CONFIG`, `MODULE_CONFIG_READER`; NestJS 12.1.2 в ADR-0002. Сопутствующие правки `tooling-lint` (`80d3d9c`, `11e24db`): декораторы параметров в Biome, ключи-имена переменных окружения, файлы декораторов, хеш конфигов от результата. Допущение A-024. Эпик E00.03 закрыт. Замечание для `tooling-lint`: pre-commit (`--staged --fix`) в E00.03.01–03 не сообщил об ошибках `naming-convention` в спеках, которые затем нашёл `--ci`, — разобраться, почему staged-режим их пропустил |
| E00.05.01 | done | `e49526d` | Приёмка: `nx test core-ts-utils` — 34 проверки (3 спеки × runtime + typecheck), код 0; affected по 5 проектам, `check:generated`, `lint:run --ci` — код 0. Пакет `core-ts-utils` (`packages/core/ts-utils`, теги `scope:shared`, `type:core`, `platform:shared`): 18 типов эпика плюс `JsonObject`/`JsonArray`/`JsonPrimitive`, `Any` — единственный алиас `any`. Допущение A-025 |
