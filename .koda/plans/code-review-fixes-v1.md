# Code Review Fixes — 34 Issues

## План исправлений

### P0: Критические ошибки

1. **[x] Убрать created_by: '' из createRelease**
   - Файлы: `src/shared/api/releases.ts`

2. **[x] Перенести navigation/toast/reset из render в useEffect в ReleaseDetail**
   - Файлы: `src/features/releases/ReleaseDetail.tsx`

3. **[x] Сузить updateChange до UpdateChangeInput**
   - Файлы: `src/shared/api/releases.ts`

4. **[x] Исправить проверку удаления изменений (canDeleteChange)**
   - Файлы: `src/features/releases/ReleaseDetail.tsx`, `src/shared/lib/roles.ts`

5. **[x] Убрать as unknown as InviteData в AcceptInvitePage**
   - Файлы: `src/pages/AcceptInvitePage.tsx`, `src/shared/api/workspaces.ts`, `src/shared/lib/schemas.ts`

6. **[x] Привести обработку Supabase errors к единому механизму**
   - Файлы: `src/shared/api/releases.ts`, `src/shared/api/workspaces.ts`, `src/shared/lib/errors.ts`

7. **[x] Добавить Zod-валидацию decision в mapReviewerRowToReviewer**
   - Файлы: `src/shared/lib/schemas.ts`, `src/shared/lib/mappers.ts`

### P1: Высокий приоритет

8. **[x] Убрать release!, workspaceId!, user!, token! non-null assertions**
   - Файлы: `src/features/releases/ReleaseDetail.tsx`, `src/pages/WorkspacePage.tsx`, `src/pages/AcceptInvitePage.tsx`

9. **[x] Использовать общие Zod-схемы в формах CreateReleaseForm и CreateChangeForm**
   - Файлы: `src/features/releases/CreateReleaseForm.tsx`, `src/features/changes/CreateChangeForm.tsx`

10. **[x] Перевести Product и Workspace forms на RHF/Zod**
    - Файлы: `src/pages/WorkspacePage.tsx`

11. **[x] Перевести AcceptInvitePage на useQuery**
    - Файлы: `src/pages/AcceptInvitePage.tsx`, `src/shared/lib/queryKeys.ts`

12. **[x] Исправить query key списка релизов: productId вместо workspaceId**
    - Файлы: `src/shared/lib/queryKeys.ts`

13. **[x] Исправить userRole casts в WorkspacePage**
    - Файлы: `src/pages/WorkspacePage.tsx`

14. **[x] Добавить skipToken для query с nullable параметрами**
    - Файлы: `src/features/releases/ReleaseDetail.tsx`, `src/pages/WorkspacePage.tsx`, `src/pages/AcceptInvitePage.tsx`

15. **[x] Синхронизировать EventType с новыми событиями**
    - Файлы: `src/shared/lib/schemas.ts`, `src/shared/types/index.ts`

### P2: Средний приоритет

16. **[x] Перенести test-зависимости в devDependencies**
    - Файл: `package.json`

17. **[x] Удалить happy-dom**
    - Файл: `package.json`

18. **[x] Добавить --max-warnings=0 и format:check**
    - Файл: `package.json`

19. **[x] Добавить явные return types API-функциям**
    - Файлы: `src/shared/api/releases.ts`, `src/shared/api/workspaces.ts`

20. **[x] Добавить PublishedReleaseNotes status: 'published'**
    - Файлы: `src/shared/types/index.ts`, `src/shared/lib/mappers.ts`

21. **[x] Очистка processedKeys при смене releaseId в realtime**
    - Файлы: `src/shared/hooks/useRealtimeSubscription.ts`

22. **[x] mapWorkspaceRowToWorkspace — добавить Zod-валидацию**
    - Файлы: `src/shared/lib/schemas.ts`, `src/shared/lib/mappers.ts`

23. **[x] mapProductRowToProduct — добавить Zod-валидацию**
    - Файлы: `src/shared/lib/schemas.ts`, `src/shared/lib/mappers.ts`

24. **[x] mapMemberRowToMember — добавить Zod-валидацию**
    - Файлы: `src/shared/lib/schemas.ts`, `src/shared/lib/mappers.ts`

25. **[x] mapProfileRowToProfile — добавить Zod-валидацию**
    - Файлы: `src/shared/lib/schemas.ts`, `src/shared/lib/mappers.ts`

26. **[x] mapCommentRowToComment — добавить Zod-валидацию**
    - Файлы: `src/shared/lib/schemas.ts`, `src/shared/lib/mappers.ts`

27. **[x] Убрать как есть — database.types.ts требует перегенерации из БД (вне зоны ответственности)**
