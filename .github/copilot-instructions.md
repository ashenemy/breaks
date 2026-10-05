# Инструкции Copilot для этого репозитория

Источник истины для правил агента: `AGENTS.md` (читать первым), затем `docs/02-code-conventions.md` и `docs/03-autopilot-protocol.md`. Этот файл только напоминает ключевое и не дублирует детали.

## Старт сессии

1. `git status`, `git log -5`.
2. `nx run progress:resume` (до готовности инструмента: `docs/progress/MANUAL.md`).
3. Файл эпика текущей задачи из `docs/epics/` и релевантные разделы `docs/01-architecture.md`.

## Что нельзя нарушать

- Один коммит затрагивает один проект Nx: `<icon> <type>: <rootScope>/<moduleScope>: <message>`, в теле `Task: <id>` и `Substep: <n>`. Хуки не обходить.
- Работа идёт в ветке `autopilot/<task-id>`; в `main` вливается fast-forward после успешной приёмки.
- Код только через генераторы Nx; структура `src/@types/index.ts`, `src/lib/`, `src/index.ts`, `test/`.
- `type`, не `interface`; `any` запрещён; явные типы членов классов; именованные экспорты через `src/index.ts`.
- Деньги: целые числа в минимальных единицах плюс код валюты.
- Строки интерфейса только через i18n-ключи (hy, ru, en).
- Angular Material только внутри `ui-web`.
- Секреты только в `.env` или AWS Secrets Manager.
- Тесты в `test/` модуля; поведение без теста не считается сделанным.
- Статус `done` ставит только `progress verify <task-id>`.

## Неясность

Не останавливаться: выбрать вариант по приоритету `AGENTS.md` > `02-code-conventions.md` > `01-architecture.md` > эпик > `00-vision-and-scope.md`, записать в `docs/decisions/assumptions.md`, продолжить. Останавливаться только на gate-задачах и при отсутствии внешнего секрета, аккаунта или платного действия.
