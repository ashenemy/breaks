# Журнал архитектурных решений (ADR)

Формат файла: `ADR-NNNN-короткое-имя.md`. Разделы: контекст, решение, альтернативы, последствия, статус (`proposed`, `accepted`, `superseded`).
Допущения, принятые агентом без участия человека, записываются в `assumptions.md` (id, дата, вопрос, вариант, причина) и пересматриваются человеком.

## Стартовые ADR (агент оформляет их в E00.01–E00.13)

| № | Тема | Состояние |
|---|---|---|
| 0001 | Регистр имён файлов (`index.ts` в нижнем регистре), структура `src/@types`, `src/lib`, `test/` | proposed |
| 0002 | Фиксация версий Node, Angular, Tailwind, NestJS, NativeScript, Nx | accepted ([ADR-0002](ADR-0002-versions.md)) |
| 0003 | AWS: регион, ECS Fargate, MongoDB Atlas, управляемые сервисы | proposed |
| 0004 | IaC: Terraform (провайдеры AWS, MongoDB Atlas, ClickHouse Cloud) | accepted |
| 0005 | Тестовый раннер: Vitest для всех проектов (Nest через SWC-плагин), Playwright для E2E | accepted |
| 0006 | Outbox и согласованность между MongoDB, PostgreSQL, OpenSearch, ClickHouse | proposed |
| 0007 | Платёжные шлюзы: на старте один тестовый шлюз-заглушка; реальные шлюзы и правовой статус удержания средств позже | accepted (заглушка) |
| 0008 | SMS-провайдер: Vonage (через интерфейс `SmsProvider`) | accepted |
| 0009 | Форматирование шаблонов Angular и SCSS в связке Biome + ESLint | open |
| 0010 | Запись в Figma из Copilot, запасной путь «дизайн в коде» | open |
| 0011 | Формат scope коммитов (`rootScope/moduleScope`) | proposed |
| 0012 | Решение go или no-go по NativeScript по итогам спайка (E00.12.05) | open |
| 0013 | E2E мобильного приложения: Maestro | proposed |
| 0014 | Теги проектов (`scope`, `type`, `platform`) и матрица границ зависимостей | accepted ([ADR-0014](ADR-0014-project-tags-and-boundaries.md)) |
