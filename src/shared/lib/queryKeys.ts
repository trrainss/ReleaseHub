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
  publicNotes: (productSlug: string) => [...releaseKeys.all, 'public', productSlug] as const,
};

export const workspaceKeys = {
  all: ['workspaces'] as const,
  list: () => [...workspaceKeys.all, 'list'] as const,
  detail: (id: string) => [...workspaceKeys.all, 'detail', id] as const,
  members: (id: string) => [...workspaceKeys.all, 'members', id] as const,
  member: (workspaceId: string, userId: string) =>
    [...workspaceKeys.all, 'member', workspaceId, userId] as const,
  assignmentMembers: (id: string) => [...workspaceKeys.all, 'assignmentMembers', id] as const,
  invites: (id: string) => [...workspaceKeys.all, 'invites', id] as const,
  products: (id: string) => [...workspaceKeys.all, 'products', id] as const,
  activity: (id: string) => [...workspaceKeys.all, 'activity', id] as const,
};

export const profileKeys = {
  all: ['profiles'] as const,
  detail: (id: string) => [...profileKeys.all, 'detail', id] as const,
};
