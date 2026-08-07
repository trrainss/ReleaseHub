import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { deleteChange, reorderChanges } from '@/shared/api/releases';
import { useToast } from '@/shared/ui/Toast';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { releaseKeys } from '@/shared/lib/queryKeys';
import { normalizePositions } from '@/shared/lib/approvalLogic';
import { SortableChangeItem } from './SortableChangeItem';
import type { ReleaseChange, ReleaseStatus } from '@/shared/types';

interface ChangeListProps {
  changes: ReleaseChange[];
  releaseId: string;
  status: ReleaseStatus;
  /** Permission predicate evaluated per change. */
  canDeleteChange: (change: ReleaseChange) => boolean;
}

export function ChangeList({ changes, releaseId, status, canDeleteChange }: ChangeListProps) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<ReleaseChange | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const deleteMutation = useMutation({
    mutationFn: (changeId: string) => deleteChange(changeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.changes(releaseId) });
      addToast('Change deleted', 'success');
      setDeleteTarget(null);
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'Failed to delete', 'error'),
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: string; position: number }[]) => reorderChanges(items),
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: releaseKeys.changes(releaseId) });
      const previous = queryClient.getQueryData<ReleaseChange[]>(releaseKeys.changes(releaseId));
      if (previous) {
        const updated = previous.map((c) => {
          const item = items.find((i) => i.id === c.id);
          return item ? { ...c, position: item.position } : c;
        });
        queryClient.setQueryData(releaseKeys.changes(releaseId), updated);
      }
      return { previous };
    },
    onError: (err, _items, context) => {
      if (context?.previous) {
        queryClient.setQueryData(releaseKeys.changes(releaseId), context.previous);
      }
      addToast(err instanceof Error ? err.message : 'Failed to reorder', 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: releaseKeys.changes(releaseId) });
    },
  });

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = changes.findIndex((c) => c.id === active.id);
    const newIndex = changes.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...changes];
    const [moved] = reordered.splice(oldIndex, 1);
    if (!moved) return;
    reordered.splice(newIndex, 0, moved);
    const normalized = normalizePositions(reordered);

    reorderMutation.mutate(normalized);
  }, [changes, reorderMutation]);

  const isDraggable = status === 'draft';

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={changes.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {changes.map((change) => (
            <SortableChangeItem
              key={change.id}
              change={change}
              isDraggable={isDraggable}
              canDelete={canDeleteChange(change)}
              onDelete={() => setDeleteTarget(change)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Change"
        message={`Delete "${deleteTarget?.title}"?`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
