# ReleaseHub

Система согласования и публикации релизов. Веб-приложение для команд, где создаются релизы продукта, добавляются изменения, проводится согласование и перевод релиза по этапам жизненного цикла.

## Технологический стек

- **Frontend:** React 19, TypeScript (strict), Vite, React Router v7, TanStack Query v5
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Forms:** React Hook Form + Zod
- **Drag & Drop:** @dnd-kit
- **Testing:** Vitest, React Testing Library, Playwright
- **Styling:** CSS (dark theme)

## Архитектурные решения

- Feature-based структура проекта
- Серверное состояние через TanStack Query с централизованными query keys
- Бизнес-логика вынесена из компонентов в pure-функции (statusMachine, approvalLogic, roles)
- Составные операции через PostgreSQL RPC (атомарность)
- RLS-политики для разграничения прав на уровне БД
- Модели данных синхронизированы между TypeScript и PostgreSQL

## Роли и разрешения

| Действие | Owner | Maintainer | Contributor |
|---|---|---|---|
| Управление пространством | ✓ | ✗ | ✗ |
| Управление участниками | ✓ | ✗ | ✗ |
| Создание/удаление продуктов | ✓ | ✗ | ✗ |
| Создание/редактирование релизов | ✓ | ✓ | ✗ |
| Удаление релиза | ✓ | ✗ | ✗ |
| Отправка на согласование | ✓ | ✓ | ✗ |
| Согласование | ✓ | ✓ | (если назначен) |
| Публикация | ✓ | ✓ | ✗ |
| Создание изменений | ✓ | ✓ | ✓ |
| Удаление своих изменений | ✓ | ✓ | ✓ |
| Комментарии | ✓ | ✓ | ✓ |

## ER-диаграмма

```
profiles ──< workspace_members >── workspaces
profiles ──< workspace_invites >── workspaces
workspaces ──< products
products ──< releases
releases ──< release_changes
releases ──< release_reviewers
releases ──< comments
workspaces ──< activity_events
```

## Локальный запуск

1. Клонировать репозиторий
2. `npm install`
3. Скопировать `.env.example` в `.env` и указать свои Supabase credentials
4. Запустить миграции Supabase
5. `npm run dev`

## Настройка Supabase

1. Создать проект в [supabase.com](https://supabase.com)
2. Выполнить миграции из `supabase/migrations/`
3. Включить Realtime для таблиц: releases, release_changes, release_reviewers, comments
4. Настроить Authentication (Email/Password)

## Переменные окружения

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## RLS-политики

Все таблицы имеют включённый RLS. Политики проверяют членство в рабочем пространстве через `workspace_members` и роль пользователя.

- Чтение: любой участник пространства
- Создание/редактирование: owner/maintainer (или автор для своих сущностей)
- Удаление: owner (или автор для своих сущностей)

## Составные RPC-операции

- `create_workspace` — создаёт пространство, участника (owner), продукт по умолчанию, запись активности атомарно
- `submit_release_for_review` — проверяет обязательные данные, создаёт назначения ревьюеров, меняет статус, логирует
- `publish_release` — проверяет роль и статус, фиксирует дату, меняет статус, логирует

## Команды проверки качества

```bash
npm run lint      # ESLint
npm run typecheck # TypeScript strict check
npm test          # Unit + component tests
npm run build     # Production build
npm run test:e2e  # Playwright e2e tests
```

## Тестовые учётные записи

| Роль | Email | Пароль |
|---|---|---|
| Owner | owner@test.com | password123 |
| Maintainer | maintainer@test.com | password123 |
| Contributor | contributor@test.com | password123 |

## Деплой

Приложение развёрнуто на: [ссылка на деплой]

## Известные ограничения

- Аватарки пользователей не реализованы (Storage не настроен)
- Уведомления (email/in-app) не реализованы
- Подтверждение email не влияет на функциональность
- Offline mode не поддерживается
- Экспорт release notes в Markdown не реализован

## Решения при неоднозначных требованиях

- Стилизация через CSS (dark theme) вместо Tailwind/MUI/Ant Design
- Статус `rejected → draft` не требует подтверждения
- Продукт по умолчанию создаётся с slug 'default' при создании пространства
- Пагинация реализована через offset/limit
- Конкурентные изменения — через поле `version` (integer) с conditional update
