import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getWorkspaceMembers } from '@/shared/api/workspaces';
import { removeMember, updateMemberRole } from '@/shared/api/workspaces';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { ErrorMessage } from '@/shared/ui/ErrorMessage';
import { useToast } from '@/shared/ui/Toast';
import { workspaceKeys } from '@/shared/lib/queryKeys';
import { useAuth } from '@/shared/hooks/useAuth';
import { canManageMembers } from '@/shared/lib/roles';
import type { Role } from '@/shared/types';

type MemberWithProfile = Awaited<ReturnType<typeof getWorkspaceMembers>>[number];

interface MemberListProps {
  workspaceId: string;
  userRole: Role;
}

export function MemberList({ workspaceId, userRole }: MemberListProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<MemberWithProfile | null>(null);

  const { data: members, isLoading, isError, error, refetch } = useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: () => getWorkspaceMembers(workspaceId),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeMember(workspaceId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) });
      addToast('Member removed', 'success');
      setDeleteTarget(null);
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'Failed to remove member', 'error'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateMemberRole(workspaceId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) });
      addToast('Role updated', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'Failed to update role', 'error'),
  });

  const canManage = canManageMembers(userRole);

  if (isLoading) return <LoadingSpinner />;
  if (isError) return <ErrorMessage message={error instanceof Error ? error.message : 'Failed to load members'} onRetry={refetch} />;

  const ownerCount = members?.filter((m) => m.role === 'owner').length ?? 0;

  return (
    <div>
      <h2>Members</h2>
      {members?.map((member) => (
        <div key={member.id} className="member-row">
          <div>
            <span className="member-row__name">{member.profile.display_name}</span>
            {member.user_id === user?.id && <span className="badge">You</span>}
          </div>
          {canManage ? (
            <div className="member-row__actions">
              <Select
                value={member.role}
                onChange={(e) =>
                  roleMutation.mutate({ userId: member.user_id, role: e.target.value })
                }
                options={[
                  { value: 'owner', label: 'Owner' },
                  { value: 'maintainer', label: 'Maintainer' },
                  { value: 'contributor', label: 'Contributor' },
                ]}
              />
              {member.role !== 'owner' || ownerCount > 1 ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setDeleteTarget(member)}
                  disabled={removeMutation.isPending}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          ) : (
            <span className={`role-badge role-badge--${member.role}`}>{member.role}</span>
          )}
        </div>
      ))}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeMutation.mutate(deleteTarget.user_id)}
        title="Remove member"
        message={`Remove ${deleteTarget?.profile.display_name} from workspace?`}
        confirmLabel="Remove"
        loading={removeMutation.isPending}
      />
    </div>
  );
}
