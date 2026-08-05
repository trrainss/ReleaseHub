import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/shared/ui/Button';
import type { ReleaseChange } from '@/shared/types';

interface SortableChangeItemProps {
  change: ReleaseChange;
  isDraggable: boolean;
  canDelete: boolean;
  onDelete: () => void;
}

export function SortableChangeItem({ change, isDraggable, canDelete, onDelete }: SortableChangeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: change.id, disabled: !isDraggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`change-item ${isDraggable ? 'change-item--draggable' : ''}`}>
      {isDraggable && (
        <button className="change-item__drag-handle" {...attributes} {...listeners} aria-label="Drag to reorder">
          &#9776;
        </button>
      )}
      <div className="change-item__content">
        <div className="change-item__header">
          <span className={`category-badge category-badge--${change.category}`}>
            {change.category}
          </span>
          <strong>{change.title}</strong>
        </div>
        <p className="change-item__description">{change.description}</p>
      </div>
      {isDraggable && canDelete && (
        <Button variant="ghost" size="sm" onClick={onDelete}>
          &times;
        </Button>
      )}
    </div>
  );
}
