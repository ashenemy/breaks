# Ручной журнал прогресса

Ведётся до готовности инструмента `tooling/progress` (E00.10). После него источником истины становятся `plan.yaml` и `state.yaml`, а этот файл архивируется.

Формат статуса: `todo`, `in_progress`, `done`, `blocked`. Статус `done` ставится только после успешного прохождения всех команд `acceptance` задачи.

## Текущая задача

| Поле | Значение |
|---|---|
| Задача | E00.01.03b — Генератор `nest-app` (обёртка `@nx/nest:application`), фиксация NestJS в ADR-0002 |
| Ветка | `autopilot/E00.01.03b` |
| Подшаги | не спланированы |
| Следующее действие | Спланировать подшаги (3–8), создать ветку |

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
