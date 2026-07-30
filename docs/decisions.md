# Architectural Decisions

## ADR-1: Организация серверного состояния

**Контекст:** Приложение требует управления серверным состоянием с кэшированием, инвалидацией и optimistic updates. Необходимо синхронизировать данные между компонентами без prop drilling и избежать race conditions при параллельных запросах.

**Рассмотренные альтернативы:**

| Альтернатива | Плюсы | Минусы |
|---|---|---|
| **TanStack Query v5** | Встроенное кэширование, инвалидация по ключам, optimistic updates, откат при ошибке, дедупликация запросов | Зависимость от внешней библиотеки |
| **Redux Toolkit + RTK Query** | Зрелое решение, devtools | Избыточный boilerplate для данного проекта |
| **Zustand + ручное кэширование** | Минимальный код | Нет встроенной инвалидации, optimistic updates придётся писать вручную |
| **React Context + useState** | Нативный React | Нет дедупликации, нет кэширования, полная перерисовка дерева |

**Решение:** Использован TanStack Query v5 с централизованными query keys.

Ключи запросов организованы иерархически, что позволяет инвалидировать связанные данные одной командой:

```typescript
export const releaseKeys = {
  all: ['releases'] as const,
  lists: () => [...releaseKeys.all, 'list'] as const,
  list: (workspaceId: string, filters?: Record<string, string>) =>
    [...releaseKeys.lists(), workspaceId, filters] as const,
  details: () => [...releaseKeys.all, 'detail'] as const,
  detail: (releaseId: string) => [...releaseKeys.details(), releaseId] as const,
  changes: (releaseId: string) => [...releaseKeys.all, 'changes', releaseId] as const,
  reviewers: (releaseId: string) => [...releaseKeys.all, 'reviewers', releaseId] as const,
  comments: (releaseId: string) => [...releaseKeys.all, 'comments', releaseId] as const,
  activity: (releaseId: string) => [...releaseKeys.all, 'activity', releaseId] as const,
};
```

**Обоснование:** TanStack Query предоставляет встроенную инвалидацию, кэширование, оптимистичные обновления и откат — всё, что требуется по заданию. Иерархические ключи позволяют точечно инвалидировать данные (например, при создании релиза инвалидируется только список, а детали других релизов остаются в кэше).

**Последствия:**
- Все API-запросы проходят через централизованный API-слой (`src/shared/api/`)
- Прямые вызовы Supabase в компонентах минимизированы — компоненты используют API-функции
- Мутации используют `onMutate` для optimistic update и `onError` для отката
- Query keys централизованы в `queryKeys.ts` — единый источник истины

---

## ADR-2: Синхронизация TypeScript-моделей с БД

**Контекст:** Необходимо обеспечить согласованность типов между frontend и схемой PostgreSQL. При изменении схемы БД типы на фронтенде должны быть синхронизированы.

**Рассмотренные альтернативы:**

| Альтернатива | Плюсы | Минусы |
|---|---|---|
| **supabase gen types** | Автоматическая генерация из схемы | Меньше контроля над nullable-полями, зависимость от инструмента |
| **Ручной слой DTO (выбран)** | Полный контроль, явные преобразования | Ручная синхронизация |
| **OpenAPI / GraphQL** | Строгий контракт | Избыточно для данного проекта |

**Решение:** Использован вариант B — собственный слой DTO с явными функциями преобразования.

Типы объявлены в `src/shared/types/index.ts` и вручную синхронизированы со схемой БД:

```typescript
export type Role = 'owner' | 'maintainer' | 'contributor';
export type ReleaseStatus = 'draft' | 'review' | 'approved' | 'rejected' | 'published';
export type ChangeCategory = 'feature' | 'improvement' | 'bugfix' | 'security' | 'breaking';

export interface Release {
  id: string;
  product_id: string;
  version: string;
  title: string;
  status: ReleaseStatus;
  row_version: number;
  // ...
}
```

Каждый enum в PostgreSQL имеет соответствующий union type в TypeScript. Каждая таблица — соответствующий interface.

**Обоснование:** Ручное управление типами даёт больше контроля над nullable-полями и enum-значениями. В проекте типы и БД синхронизированы через единую миграцию (`supabase/migrations/20240101000000_initial_schema.sql`), что упрощает поддержку соответствия.

**Последствия:**
- При изменении схемы БД нужно вручную обновлять типы в `types/index.ts`
- Добавлен `supabase/.gitignore` для исключения локальных конфигов
- В будущем можно перейти на автоматическую генерацию через `supabase gen types --lang=typescript`

---

## ADR-3: Реализация ролей и RLS

**Контекст:** Права должны проверяться на трёх уровнях: интерфейс, прикладная логика, БД. Система должна предотвращать как случайные ошибки, так и намеренные попытки обхода ограничений.

**Рассмотренные альтернативы:**

| Альтернатива | Плюсы | Минусы |
|---|---|---|
| **Только UI-проверки** | Простота | Нет защиты при прямых API-запросах |
| **UI + RPC (выбран)** | Защита на уровне БД и интерфейса | Дублирование логики проверок |
| **Только RLS** | Единая точка контроля | Невозможно скрыть элементы UI |

**Решение:** Трёхуровневая система проверок:

1. **UI:** Компоненты скрывают кнопки через функции из `roles.ts`:

```typescript
export function canManageMembers(role: Role): boolean { return role === 'owner'; }
export function canCreateRelease(role: Role): boolean { return role === 'owner' || role === 'maintainer'; }
export function canPublish(role: Role): boolean { return role === 'owner' || role === 'maintainer'; }
```

2. **RPC:** Серверные функции проверяют роль перед выполнением:

```sql
IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ... AND user_id = auth.uid() AND role = 'owner') THEN
  RAISE EXCEPTION 'Only owners can perform this action';
END IF;
```

3. **RLS:** Политики на всех таблицах (см. README — полная таблица политик).

**Обоснование:** Трёхуровневая защита предотвращает случайные и намеренные нарушения прав. RLS — последняя линия обороны, которая защищает данные даже при прямых SQL-запросах. RPC-функции добавляют бизнес-валидации, которые невозможно выразить в RLS (например, "нельзя отправить на согласование релиз без изменений"). UI-проверки улучшают UX — пользователь не видит недоступные действия.

**Последствия:**
- При добавлении новой роли нужно обновить три уровня
- RPC-функции используют `SECURITY DEFINER`, что требует осторожности
- Проверки дублируются, но это intentional — defence in depth

---

## ADR-4: Обработка optimistic update

**Контекст:** Drag-and-drop сортировка изменений должна обновлять интерфейс мгновенно, без ожидания ответа сервера. При ошибке сортировка должна откатываться к предыдущему состоянию.

**Рассмотренные альтернативы:**

| Альтернатива | Плюсы | Минусы |
|---|---|---|
| **Optimistic update (выбран)** | Мгновенный UI | Сложность реализации отката |
| **Synchronous mutation** | Простота | Задержка UI при перетаскивании |
| **WebSocket push** | Реальное время | Избыточно для сортировки |

**Решение:** Использован `onMutate` в TanStack Query mutation:

```typescript
const mutation = useMutation({
  mutationFn: (changes) => reorderChanges(changes),
  onMutate: async (items) => {
    await queryClient.cancelQueries({ queryKey: releaseKeys.changes(releaseId) });
    const previous = queryClient.getQueryData(releaseKeys.changes(releaseId));
    queryClient.setQueryData(releaseKeys.changes(releaseId), (old) => {
      if (!old) return old;
      // Обновляем позиции в кэше
      return old.map((item) => ({
        ...item,
        position: items.find((i) => i.id === item.id)?.position ?? item.position,
      }));
    });
    return { previous };
  },
  onError: (err, _items, context) => {
    if (context?.previous) {
      queryClient.setQueryData(releaseKeys.changes(releaseId), context.previous);
    }
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: releaseKeys.changes(releaseId) });
  },
});
```

**Обоснование:** Drag-and-drop должен быть отзывчивым — пользователь не должен ждать ответа сервера, чтобы увидеть результат перетаскивания. TanStack Query предоставляет встроенный механизм для optimistic update и отката.

**Последствия:**
- Все мутации с optimistic update должны сохранять предыдущее состояние для отката
- При ошибке запроса данные автоматически возвращаются к исходному состоянию
- После завершения мутации (успех или ошибка) кэш инвалидируется для синхронизации с сервером

---

## ADR-5: Обработка Realtime-событий

**Контекст:** Изменения на странице релиза должны отображаться без ручного обновления. Несколько пользователей могут одновременно работать с одним релизом (ревьюеры комментируют, автор добавляет изменения).

**Рассмотренные альтернативы:**

| Альтернатива | Плюсы | Минусы |
|---|---|---|
| **Supabase Realtime + инвалидация кэша (выбран)** | Простота, надёжность | Задержка до перезапроса |
| **Supabase Realtime + прямое обновление** | Мгновенное отображение | Сложность синхронизации состояний |
| **Polling** | Простота | Избыточные запросы, задержка |

**Решение:** Supabase Realtime подписки на конкретный release ID с инвалидацией кэша TanStack Query:

```typescript
export function useRealtimeRelease(releaseId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`release-${releaseId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'releases',
          filter: `id=eq.${releaseId}` },
        () => queryClient.invalidateQueries({ queryKey: releaseKeys.detail(releaseId) })
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'release_changes',
          filter: `release_id=eq.${releaseId}` },
        () => queryClient.invalidateQueries({ queryKey: releaseKeys.changes(releaseId) })
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'release_reviewers',
          filter: `release_id=eq.${releaseId}` },
        () => queryClient.invalidateQueries({ queryKey: releaseKeys.reviewers(releaseId) })
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'comments',
          filter: `release_id=eq.${releaseId}` },
        () => queryClient.invalidateQueries({ queryKey: releaseKeys.comments(releaseId) })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [releaseId, queryClient]);
}
```

**Обоснование:** Realtime через Supabase — часть обязательного стека. Фильтрация по конкретному релизу предотвращает лишнюю инвалидацию кэша других релизов. Инвалидация кэша вместо прямого обновления — это компромисс: вместо сложной логики слияния данных мы просто перезапрашиваем их. При типичных размерах данных (десятки-сотни записей) это происходит незаметно для пользователя.

**Последствия:**
- Подписка создаётся при монтировании компонента и удаляется при размонтировании (cleanup в useEffect)
- Все 4 связанные таблицы (releases, release_changes, release_reviewers, comments) подписаны на изменения
- Инвалидируется только соответствующий ключ кэша — не весь кэш приложения
- Realtime-публикация настроена в миграции (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`)
