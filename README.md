# ReleaseHub

Система согласования и публикации релизов. Веб-приложение для команд, где создаются релизы продукта, добавляются изменения, проводится согласование и перевод релиза по этапам жизненного цикла.

**Деплой:** [https://release-hub-nu.vercel.app](https://release-hub-nu.vercel.app)
**Репозиторий:** [https://github.com/trrainss/ReleaseHub](https://github.com/trrainss/ReleaseHub)

---

## Содержание

- [Технологический стек](#технологический-стек)
- [Архитектурные решения](#архитектурные-решения)
- [ER-диаграмма](#er-диаграмма)
- [Инструкция локального запуска](#инструкция-локального-запуска)
- [Инструкция настройки Supabase](#инструкция-настройки-supabase)
- [Переменные окружения](#переменные-окружения)
- [Роли и разрешения](#роли-и-разрешения)
- [Описание RLS-политик](#описание-rls-политик)
- [Объяснение составных RPC-операций](#объяснение-составных-rpc-операций)
- [Команды проверки качества](#команды-проверки-качества)
- [Ссылка на деплой](#ссылка-на-деплой)
- [Тестовые учётные записи](#тестовые-учётные-записи)
- [Известные ограничения](#известные-ограничения)
- [Решения при неоднозначных требованиях](#решения-при-неоднозначных-требованиях)

---

## Технологический стек

| Компонент | Технология |
|-----------|-----------|
| **Frontend** | React 19, TypeScript 6 (strict) |
| **Сборка** | Vite 8 |
| **Роутинг** | React Router v7 |
| **Серверное состояние** | TanStack Query v5 |
| **Формы** | React Hook Form + Zod 4 |
| **Drag & Drop** | @dnd-kit |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime) |
| **Стилизация** | CSS (dark theme, кастомная дизайн-система) |
| **Тестирование** | Vitest, React Testing Library, Playwright |
| **UI-библиотека** | Ant Design v6 (только ConfigProvider для темы) |

---

## Архитектурные решения

### Feature-based структура проекта

```
src/
├── app/          # Инициализация приложения (router, providers, queryClient)
├── features/     # Модули по фичам (auth, releases, changes, comments, etc.)
├── pages/        # Страницы-композиции из фич
├── shared/       # Общие модули (ui, api, hooks, lib, types)
└── test/         # Тестовые утилиты
```

Каждая фича содержит связанные компоненты, логику и запросы. Фичи не импортируют друг друга напрямую — только через shared-слой или страницу.

### Серверное состояние через TanStack Query

TanStack Query v5 управляет всеми запросами к API. Ключи запросов организованы иерархически:

- `releaseKeys.list(workspaceId, filters)` — списки релизов с учётом фильтров
- `releaseKeys.detail(releaseId)` — детали релиза
- `releaseKeys.changes(releaseId)` — изменения релиза
- `releaseKeys.reviewers(releaseId)` — ревьюеры
- `releaseKeys.comments(releaseId)` — комментарии
- `releaseKeys.activity(releaseId)` — активность

Мутации используют optimistic update для мгновенного отклика UI (особенно для drag-and-drop сортировки изменений).

### Бизнес-логика в pure-функциях

Логика вынесена из компонентов в чистые функции:

- **`statusMachine.ts`** — конечный автомат статусов релиза (draft → review → approved → published)
- **`approvalLogic.ts`** — расчёт статуса голосования (approve/reject/pending)
- **`roles.ts`** — проверки разрешений по роли (canManageMembers, canPublish, etc.)

### RPC-функции PostgreSQL

Критические операции реализованы как составные RPC-функции на PostgreSQL, выполняемые атомарно:

- `create_workspace` — создаёт workspace + участника + продукт + запись активности
- `submit_release_for_review` — валидирует, меняет статус, назначает ревьюеров, логирует
- `publish_release` — проверяет роль и статус, публикует, логирует

### Realtime-подписки

Страница деталей релиза подписывается на изменения через Supabase Realtime. Подписка фильтруется по `release_id` через `postgres_changes`. При изменении данных — инвалидируется соответствующий кэш TanStack Query.

Полный список архитектурных решений описан в [docs/decisions.md](docs/decisions.md).

---

## ER-диаграмма

```
┌─────────────────────────────────────────────────────────────────┐
│                        ReleaseHub                              │
└─────────────────────────────────────────────────────────────────┘

auth.users
    │
    │ (триггер on_auth_user_created → создаёт profile)
    ▼
┌──────────────┐
│   profiles   │──────< workspace_members >──────┐
│──────────────│      │                          │
│ id (PK)      │      │ user_id (FK)             │
│ display_name │      │ workspace_id (FK)        │
│ avatar_url   │      │ role (owner/maintainer/  │
│ created_at   │      │      contributor)        │
└──────────────┘      └──────────────────────────┘
        │                     │
        │ 1                    │ N
        ▼                     ▼
  ┌──────────────┐  ┌──────────────────┐
  │  comments    │  │  workspaces      │
  │──────────────│  │──────────────────│
  │ id (PK)      │  │ id (PK)          │
  │ release_id   │  │ name             │
  │ user_id (FK) │  │ created_by (FK)  │
  │ content      │  │ created_at       │
  │ created_at   │  └────────┬─────────┘
  └──────────────┘           │
                             │ 1
                             │
                    ┌────────┴─────────┐
                    │  workspace_invites│
                    │──────────────────│
                    │ id (PK)          │
                    │ workspace_id(FK) │
                    │ email            │
                    │ role             │
                    │ token_hash       │
                    │ status           │
                    │ expires_at       │
                    │ invited_by (FK)  │
                    └──────────────────┘
                             │
                             │ 1
                             ▼
                    ┌──────────────────┐
                    │    products      │
                    │──────────────────│
                    │ id (PK)          │
                    │ workspace_id(FK) │
                    │ name             │
                    │ slug             │
                    │ description      │
                    └────────┬─────────┘
                             │
                             │ 1
                             ▼
                    ┌──────────────────┐
                    │    releases      │
                    │──────────────────│
                    │ id (PK)          │
                    │ product_id (FK)  │
                    │ version          │
                    │ title            │
                    │ description      │
                    │ status (draft/   │
                    │   review/approved│
                    │   /rejected/     │
                    │   published)     │
                    │ planned_at       │
                    │ published_at     │
                    │ created_by (FK)  │
                    │ row_version      │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────────┐
              │              │                   │
              ▼              ▼                   ▼
  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐
  │ release_changes  │  │release_rev.  │  │activity_ev.  │
  │──────────────────│  │──────────────│  │──────────────│
  │ id (PK)          │  │ id (PK)      │  │ id (PK)      │
  │ release_id (FK)  │  │ release_id   │  │workspace_id  │
  │ title            │  │ user_id (FK) │  │ release_id   │
  │ description      │  │ decision     │  │ actor_id(FK) │
  │ category         │  │ decided_at   │  │ event_type   │
  │ position         │  └──────────────┘  │ payload      │
  │ created_by (FK)  │                     │ created_at   │
  └──────────────────┘                     └──────────────┘
```

**Связи:**
- `profiles` 1:N → `comments`, `workspace_members`, `releases`, `release_changes`
- `workspaces` 1:N → `workspace_members`, `workspace_invites`, `products`, `activity_events`
- `products` 1:N → `releases`
- `releases` 1:N → `release_changes`, `release_reviewers`, `comments`
- `activity_events` опционально ссылается на `releases`

---

## Инструкция локального запуска

### Требования

- Node.js 20+
- npm 9+
- Аккаунт в [Supabase](https://supabase.com)

### Шаги

1. **Клонировать репозиторий**

```bash
git clone https://github.com/trrainss/ReleaseHub.git
cd ReleaseHub
```

2. **Установить зависимости**

```bash
npm install
```

3. **Настроить переменные окружения**

```bash
cp .env.example .env
```

Отредактировать `.env`, указав свои Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

4. **Запустить миграции Supabase**

Выполнить содержимое файла `supabase/migrations/20240101000000_initial_schema.sql` в SQL Editor панели Supabase или через Supabase CLI:

```bash
npx supabase migration up
```

5. **Запустить dev-сервер**

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:5173`.

---

## Инструкция настройки Supabase

### 1. Создание проекта

1. Зарегистрироваться на [supabase.com](https://supabase.com)
2. Создать новый проект
3. Дождаться инициализации базы данных

### 2. Выполнение миграций

1. Перейти в **SQL Editor**
2. Открыть файл `supabase/migrations/20240101000000_initial_schema.sql`
3. Скопировать и выполнить весь скрипт
4. Убедиться, что все таблицы, функции и политики созданы (нет ошибок)

### 3. Настройка Authentication

1. Перейти в **Authentication → Providers**
2. Включить **Email/Password** (по умолчанию включён)
3. Отключить "Confirm email" (опционально, для упрощения тестирования)

### 4. Включение Realtime

1. Перейти в **Database → Replication**
2. В секции **Publication tables** убедиться, что таблицы отмечены:
   - `releases`
   - `release_changes`
   - `release_reviewers`
   - `comments`

(Миграция автоматически добавляет их в publication, но стоит проверить)

### 5. Получение API-ключей

1. Перейти в **Project Settings → API**
2. Скопировать `Project URL` → в `.env` как `VITE_SUPABASE_URL`
3. Скопировать `anon public key` → в `.env` как `VITE_SUPABASE_ANON_KEY`

---

## Переменные окружения

| Переменная | Обязательная | Описание |
|-----------|-------------|----------|
| `VITE_SUPABASE_URL` | Да | URL проекта Supabase (https://*.supabase.co) |
| `VITE_SUPABASE_ANON_KEY` | Да | Публичный анонимный ключ Supabase |

Обе переменные начинаются с `VITE_`, так как Vite экранирует их в клиентский код.

---

## Роли и разрешения

В системе три роли с иерархией: **Owner > Maintainer > Contributor**.

| Действие | Owner | Maintainer | Contributor |
|----------|:-----:|:----------:|:-----------:|
| Управление пространством | ✓ | ✗ | ✗ |
| Управление участниками | ✓ | ✗ | ✗ |
| Создание/удаление продуктов | ✓ | ✗ | ✗ |
| Создание/редактирование релизов | ✓ | ✓ | ✗ |
| Удаление релиза | ✓ | ✗ | ✗ |
| Отправка на согласование | ✓ | ✓ | ✗ |
| Согласование (approve/reject) | ✓ | ✓ | если назначен |
| Публикация релиза | ✓ | ✓ | ✗ |
| Создание изменений | ✓ | ✓ | ✓ |
| Редактирование своих изменений | ✓ | ✓ | ✓ |
| Удаление своих изменений | ✓ | ✓ | ✓ |
| Комментарии | ✓ | ✓ | ✓ |
| Удаление комментариев | ✓ | ✗ | ✗ |

Проверки реализованы на трёх уровнях:
1. **UI** — компоненты скрывают кнопки через функции из `roles.ts`
2. **RPC** — серверные функции проверяют роль перед выполнением
3. **RLS** — политики БД блокируют несанкционированный доступ

---

## Описание RLS-политик

Все таблицы имеют включённый Row Level Security (RLS). Политики используют вспомогательные функции:

- `public.is_member(ws_id)` — проверяет членство в workspace
- `public.is_owner(ws_id)` — проверяет роль owner в workspace

### Таблицы и политики

| Таблица | SELECT | INSERT | UPDATE | DELETE |
|---------|--------|--------|--------|--------|
| **profiles** | Все | Только свой id | Только свой id | — |
| **workspaces** | Члены workspace | Создатель = auth.uid() | Owner | Owner |
| **workspace_members** | Члены workspace | Owner | Owner | Owner |
| **workspace_invites** | Члены workspace | Owner | Owner | Owner |
| **products** | Члены workspace | Owner | Owner | Owner |
| **releases** | Члены workspace | Owner/Maintainer | Owner/Maintainer | Owner |
| **release_changes** | Члены workspace | Члены workspace | Члены workspace | Члены workspace |
| **release_reviewers** | Члены workspace | Owner/Maintainer | Только свой user_id | — |
| **comments** | Члены workspace | Члены workspace | — | Автор или Owner |
| **activity_events** | Члены workspace | — | — | — |

Политики для `releases`, `release_changes`, `release_reviewers` и `comments` определяют workspace_id через JOIN по цепочке `releases → products → workspaces`.

---

## Объяснение составных RPC-операций

### `create_workspace(p_name TEXT)`

**Назначение:** Атомарное создание рабочего пространства с начальной настройкой.

**Операции внутри:**
1. Вставка записи в `workspaces` (создатель = текущий пользователь)
2. Вставка записи в `workspace_members` (роль: owner)
3. Вставка продукта по умолчанию в `products` (slug: 'default')
4. Вставка записи в `activity_events` (тип: workspace_created)

**Атомарность:** Все операции выполняются в одной транзакции. Если любая из них падает — откатываются все.

### `submit_release_for_review(p_release_id UUID, p_reviewer_ids UUID[])`

**Назначение:** Отправка релиза на согласование.

**Валидации:**
1. Релиз существует
2. Статус релиза — 'draft'
3. У релиза есть title и version
4. У релиза есть хотя бы одно изменение
5. Назначен хотя бы один ревьюер

**Операции внутри:**
1. Обновление статуса релиза на 'review'
2. Вставка ревьюеров в `release_reviewers` (с игнорированием дубликатов)
3. Вставка записи в `activity_events`

### `approve_release(p_release_id UUID)`

**Назначение:** Одобрение релиза ревьюером.

**Логика:**
1. Проверка: релиз в статусе 'review'
2. Проверка: текущий пользователь назначен ревьюером
3. Обновление `release_reviewers` (decision = 'approve')
4. Если все ревьюеры одобрили — статус релиза → 'approved', иначе остаётся 'review'

### `reject_release(p_release_id UUID)`

**Назначение:** Отклонение релиза ревьюером.

**Логика:**
1. Проверка: релиз в статусе 'review'
2. Проверка: текущий пользователь назначен ревьюером
3. Обновление `release_reviewers` (decision = 'reject')
4. Статус релиза → 'rejected'

### `publish_release(p_release_id UUID)`

**Назначение:** Публикация одобренного релиза.

**Валидации:**
1. Релиз существует
2. Статус релиза — 'approved'
3. Текущий пользователь — owner или maintainer

**Операции внутри:**
1. Обновление статуса на 'published' + фиксация `published_at`
2. Вставка записи в `activity_events` с payload (version, published_at)

### `update_release(p_release_id UUID, p_expected_version INTEGER, ...)`

**Назначение:** Конкурентное обновление релиза с оптимистичной блокировкой.

**Логика:**
1. Чтение текущей версии (`row_version`)
2. Сравнение с ожидаемой версией (`p_expected_version`)
3. Если не совпадает — ошибка "Conflict: release was modified by another user"
4. Если совпадает — обновление + инкремент `row_version`

### `reorder_changes(p_changes JSONB)`

**Назначение:** Массовое обновление позиций изменений (drag-and-drop).

**Логика:**
- Принимает JSONB-массив вида `[{id: UUID, position: INT}, ...]`
- Обновляет позиции в одной транзакции

### `invite_member(p_workspace_id UUID, p_email TEXT, p_role user_role)`

**Назначение:** Приглашение участника.

**Валидации:**
1. Текущий пользователь — owner пространства
2. Пользователь с таким email ещё не является участником

**Операции внутри:**
1. Генерация `token_hash` (32 байта в hex)
2. Вставка в `workspace_invites`

### `accept_invite(p_token_hash TEXT)`

**Назначение:** Принятие приглашения.

**Валидации:**
1. Текущий пользователь авторизован
2. Приглашение существует, статус 'pending', не истекло
3. Email приглашения совпадает с email текущего пользователя

**Операции внутри:**
1. Вставка в `workspace_members`
2. Обновление статуса приглашения на 'accepted'

---

## Команды проверки качества

```bash
# TypeScript strict check
npm run typecheck

# ESLint
npm run lint

# Unit + component tests
npm test

# Tests in watch mode
npm run test:watch

# E2E tests (Playwright)
npm run test:e2e

# Production build
npm run build

# Preview production build
npm run preview

# Format code
npm run format
```

---

## Ссылка на деплой

**Production:** [https://release-hub-nu.vercel.app](https://release-hub-nu.vercel.app)

**Репозиторий:** [https://github.com/trrainss/ReleaseHub](https://github.com/trrainss/ReleaseHub)

Деплой настроен через Vercel. При каждом пуше в ветку `main` происходит автоматический деплой.

---

## Тестовые учётные записи

> Для создания тестовых аккаунтов зарегистрируйтесь через форму регистрации на сайте или создайте пользователей в панели Supabase (Authentication → Users → Add User).

| Роль | Email | Пароль | Статус |
|------|-------|--------|--------|
| Owner | owner@test.com | password123 | Требуется регистрация |
| Maintainer | maintainer@test.com | password123 | Требуется регистрация |
| Contributor | contributor@test.com | password123 | Требуется регистрация |

**Сценарий тестирования:**
1. Зарегистрировать owner@test.com → создать workspace → появится роль owner
2. Зарегистрировать maintainer@test.com и contributor@test.com
3. Owner приглашает их через Invitations
4. Owner создаёт релиз, добавляет изменения
5. Owner назначает ревьюеров и отправляет на согласование
6. Ревьюеры заходят в релиз и approve/reject
7. После одобрения всеми — owner/maintainer публикует релиз

---

## Известные ограничения

1. **Аватарки пользователей** — не реализованы (Storage не настроен). Поле `avatar_url` в таблице `profiles` всегда NULL.
2. **Уведомления** — email и in-app уведомления не реализованы. Пользователь должен самостоятельно обновлять страницу или полагаться на Realtime-подписки.
3. **Подтверждение email** — не влияет на функциональность. Можно отключить в настройках Supabase Authentication.
4. **Offline mode** — не поддерживается. Приложение требует постоянного соединения с сервером.
5. **Экспорт release notes** — в Markdown/PDF не реализован.
6. **Пагинация** — простая offset/limit, без курсорной пагинации.
7. **История изменений** — не сохраняется после публикации (только activity_events).
8. **Массовые операции** — не поддерживаются (например, массовое удаление/изменение релизов).
9. **Drag-and-drop** — работает только для сортировки изменений внутри релиза, не для релизов.
10. **Сброс пароля** — реализован, но требует настройки SMTP в Supabase.

---

## Решения при неоднозначных требованиях

1. **Стилизация:** Выбрана кастомная CSS-дизайн-система с тёмной темой вместо Tailwind/MUI/Ant Design. Это даёт полный контроль над визуалом и уникальный внешний вид, непохожий на типовые AI-проекты.

2. **Статус `rejected → draft`:** После отклонения релиз возвращается в черновик без дополнительных подтверждений. Это упрощает flow и позволяет автору сразу исправить замечания.

3. **Продукт по умолчанию:** При создании workspace автоматически создаётся продукт с slug 'default'. Это избавляет пользователя от лишнего шага, но при необходимости можно создать дополнительные продукты.

4. **Пагинация через offset/limit:** Выбрана простая offset-пагинация вместо cursor-based, так как объём данных в типовом workspace не превышает тысяч записей.

5. **Конкурентные изменения:** Использован оптимистичный подход с полем `row_version` (integer) и conditional update в RPC. Если другой пользователь изменил релиз — клиент получает ошибку конфликта и должен перезагрузить данные.

6. **Трёхуровневая проверка прав:** UI (скрытие кнопок) + RPC (проверка роли) + RLS (защита на уровне БД). Это обеспечивает защиту даже при прямых запросах к API.

7. **Realtime-подписки:** Использован паттерн "подписка → инвалидация кэша TanStack Query" вместо прямого обновления состояния. Это проще и надёжнее, чем синхронизация данных вручную.
