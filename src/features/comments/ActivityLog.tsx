import type { ActivityEvent } from '@/shared/types';

interface ActivityLogProps {
  events: ActivityEvent[];
}

const EVENT_LABELS: Record<string, string> = {
  workspace_created: 'Workspace created',
  release_created: 'Release created',
  release_submitted: 'Submitted for review',
  release_approved: 'Approved',
  release_rejected: 'Rejected',
  release_published: 'Published',
  member_added: 'Member added',
  member_removed: 'Member removed',
  role_changed: 'Role changed',
};

export function ActivityLog({ events }: ActivityLogProps) {
  if (events.length === 0) {
    return <p className="text-muted">No activity yet.</p>;
  }

  return (
    <div className="activity-log">
      {events.map((event) => (
        <div key={event.id} className="activity-log__item">
          <div className="activity-log__dot" />
          <div>
            <p className="activity-log__text">{EVENT_LABELS[event.event_type] ?? event.event_type}</p>
            <p className="activity-log__date">{new Date(event.created_at).toLocaleString()}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
