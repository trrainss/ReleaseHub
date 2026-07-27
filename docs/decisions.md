# Architectural Decisions

## ADR-1: Организация серверного состояния

**Контекст:** Приложение требует управления серверным состоянием с кэшированием, инвалидацией и optimistic updates.

**Решение:** Использован TanStack Query v5 с централизованными query keys.

Query keys организованы иерархически:
- `releaseKeys.all` — корневой ключ
- `releaseKeys.list(workspaceId, filters)` — списки с параметрами
- `releaseKeys.detail(releaseId)` — детали
- `releaseKeys.changes(releaseId)` — изменения
- `releaseKeys.reviewers(releaseId)` — ревьюеры
- `releaseKeys.comments(releaseId)` — комментарии
- `releaseKeys.activity(releaseId)` — активность

**Альтернативы:** Redux, Zustand, useState.

**Обоснование:** TanStack Query предоставляет встроенную инвалидацию, кэширование, оптимистичные обновления и откат — всё, что требуется по заданию.

---

## ADR-2: Синхронизация TypeScript-моделей с БД

**Контекст:** Необходимо обеспечить согласованность типов между frontend и схемой PostgreSQL.

**Решение:** Использован вариант B — собственный слой DTO с явными функциями преобразования (mappers).

Типы объявлены в `src/shared/types/index.ts` и вручную синхронизированы со схемой БД. Функции map*RowTo*() вызываются при работе с API.

**Альтернативы:** Вариант A — генерация типов из Supabase схемы (supabase gen types).

**Обоснование:** Ручное управление типами даёт больше контроля над nullable-полями и enum-значениями. В проекте типы и БД синхронизированы вручную.

---

## ADR-3: Реализация ролей и RLS

**Контекст:** Права должны проверяться на трёх уровнях: интерфейс, прикладная логика, БД.

**Решение:**
1. **UI:** Компоненты скрывают кнопки через функции `canManageMembers()`, `canPublish()` и т.д.
2. **Logic:** RPC-функции проверяют роль перед выполнением.
3. **Database:** RLS-политики на всех таблицах проверяют членство в workspace и роль в workspace_members.

**Обоснование:** Трёхуровневая защита предотвращает случайные и намеренные нарушения прав. RLS — последняя линия обороны.

---

## ADR-4: Обработка optimistic update

**Контекст:** Drag-and-drop сортировка изменений должна обновлять интерфейс мгновенно.

**Решение:** Использован `onMutate` в TanStack Query mutation:
1. Отмена текущих запросов
2. Сохранение предыдущего состояния
3. Оптимистичное обновление кэша
4. Откат при ошибке в `onError`
5. Инвалидация в `onSettled`

```typescript
onMutate: async (items) => {
  await queryClient.cancelQueries({ queryKey: releaseKeys.changes(releaseId) });
  const previous = queryClient.getQueryData(...);
  queryClient.setQueryData(...);
  return { previous };
},
onError: (err, _items, context) => {
  if (context?.previous) queryClient.setQueryData(..., context.previous);
};
```

---

## ADR-5: Обработка Realtime-событий

**Контекст:** Изменения на странице релиза должны отображаться без ручного обновления.

**Решение:** Supabase Realtime подписки на конкретный release ID через `channel()`. Фильтрация происходит по `release_id` для изменений, комментариев, голосов и статуса. Подписка удаляется при размонтировании компонента (cleanup в useEffect).

**Обоснование:** Realtime через Supabase — часть обязательного стека. Фильтрация по конкретному релизу предотвращает лишнюю инвалидацию кэша других релизов.
