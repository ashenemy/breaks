# ТЗ: мультивендор-маркетплейс строительных товаров (Армения)

Пакет документов для автономной реализации ИИ-агентом (GitHub Copilot, основная модель Claude).
Цель: релизный продукт без компромиссов, поэтапно, с автоматической проверкой каждого шага.

## Как читать

| Файл | Что внутри | Статус |
|---|---|---|
| `AGENTS.md`, `.github/copilot-instructions.md` | Короткие правила для агента, читаются первыми | Часть 1 |
| `docs/START.md` | Запуск автопилота: подготовка, первый промпт, что нужно от человека и когда | Готово |
| `docs/00-vision-and-scope.md` | Цели, роли, глоссарий, границы, журнал решений | Часть 1 |
| `docs/01-architecture.md` | Стек, базы, AWS, структура монорепо, сквозные механизмы | Часть 1 |
| `docs/02-code-conventions.md` | Стиль кода, именование, линтинг, формат коммитов | Часть 1 |
| `docs/03-autopilot-protocol.md` | Рабочий цикл агента, Definition of Done, инструмент прогресса и возобновления, фаза дизайна | Часть 1 |
| `docs/04-roadmap.md` | Этапы M0–M8, список эпиков с зависимостями | Часть 1 |
| `docs/05-cross-cutting-requirements.md` | Неявные требования: i18n, a11y, SEO, безопасность, наблюдаемость и т.д. | Часть 1 |
| `docs/epics/E*.md` | Один файл на эпик: сущности, сценарии, API, состояния, задачи, критерии приёмки | все 61 эпик готов (448 задач, 7 gate-задач) |
| `docs/decisions` | Журнал архитектурных решений (ADR) | Ведётся постоянно |
| `docs/progress` | План, состояние и отчёт по прогрессу | Генерируется инструментом |

## Порядок действий для человека

1. Проверить Часть 1 и поправить.
2. Пройти по `docs/START.md`: подготовить репозиторий и запустить агента с первой задачи E00.01.

## Работа с репозиторием

### Окружение

- Node.js из `.nvmrc` (24 LTS) и pnpm через corepack (`corepack enable`; версия из `packageManager` в `package.json`). Другие версии отклоняются при установке (`engine-strict`).
- Установка: `pnpm install --frozen-lockfile`. Версии зависимостей точные (ADR-0002); скрипты сборки зависимостей запрещены, кроме allow-list в `pnpm-workspace.yaml`.
- Команды Nx запускаются как `pnpm nx <команда>` (или `nx`, если установлен глобально). Демон Nx отключён по умолчанию (A-009); включить локально можно через `NX_DAEMON=true`.

### Структура

| Каталог | Содержимое |
|---|---|
| `apps/` | Приложения: `api`, `worker`, `web-*`, `mobile-*` |
| `packages/<тип>/<имя>` | Пакеты: `core`, `contracts`, `ui`, `design`, `infra`, `tooling` |
| `modules/<домен>/<платформа>` | Доменные модули: `api`, `web`, `native` |
| `tools/` | Корневые скрипты воркспейса, не являющиеся проектами Nx (границы, проверки CI) |
| `docs/` | ТЗ, архитектура, конвенции, эпики, ADR, журнал прогресса |

Каждый проект: `src/@types/index.ts` (все типы), `src/lib/` (реализация), `src/index.ts` (только именованные экспорты), `test/` (тесты), `README.md`, `project.json` с тегами `scope:*`, `type:*`, `platform:*` и маркером `metadata.generator`.

### Генераторы

Проекты создаются только генераторами `@market/tooling` (`packages/tooling/generators`), иначе CI-проверка `pnpm check:generated` отклонит проект:

```bash
pnpm nx g @market/tooling:lib ts-utils --type=core
pnpm nx g @market/tooling:lib catalog-api --type=module --platform=api --scope=catalog --directory=modules/catalog/api
```

Границы между проектами (ADR-0014) проверяет ESLint: `web`, `api` и `native` не зависят друг от друга, слои зависят только вниз, `tooling` никем не импортируется, общий код не знает о доменах.

### Команды

| Команда | Что делает |
|---|---|
| `pnpm nx run-many -t lint typecheck test build --all` | Все цели всех проектов (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — по одной) |
| `pnpm affected` | Только затронутые проекты относительно `main` (`--base`, `--head` переопределяют); есть `affected:lint`, `affected:test`, `affected:build`, `affected:typecheck` |
| `pnpm nx test <проект> --coverage` | Тесты проекта с проверкой порога покрытия 90% |
| `pnpm test:boundaries` | Негативный и позитивный тест правил границ |
| `pnpm check:generated` | Все проекты созданы генераторами (маркер в `project.json`) |
| `pnpm test:tools` | Тесты корневых скриптов `tools/` |
| `pnpm ci` | Полный набор проверок для CI: маркеры, `tools/`, затронутые `lint`, `typecheck`, `test`, `build` |
| `pnpm graph` | Граф проектов в `tmp/graph.json` (`pnpm nx graph` открывает интерактивный) |

Результаты целей кэшируются в `.nx/cache` (локально, не в git); `--skip-nx-cache` отключает кэш для одного запуска, `pnpm nx reset` очищает его.

### Коммиты и прогресс

- Ветка задачи `autopilot/<task-id>`, в `main` вливается fast-forward после приёмки.
- Один коммит — один проект Nx: `<icon> <type>: <rootScope>/<moduleScope>: <message>`, в теле `Task: <id>` и `Substep: <n>` (`docs/02-code-conventions.md`, раздел 9).
- Состояние задач до появления `tooling/progress`: `docs/progress/MANUAL.md`.

## Правило приоритета при противоречиях

`AGENTS.md` > `02-code-conventions.md` > `01-architecture.md` > файл эпика > `00-vision-and-scope.md`.
Если агент обнаружил противоречие, он фиксирует его в `docs/decisions/assumptions.md`, выбирает вариант по этому порядку и продолжает работу.
