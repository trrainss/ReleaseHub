import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { releaseKeys } from '@/shared/lib/queryKeys';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export function useRealtimeRelease(releaseId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`release-${releaseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'releases',
          filter: `id=eq.${releaseId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: releaseKeys.detail(releaseId) });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'release_changes',
          filter: `release_id=eq.${releaseId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            queryClient.invalidateQueries({ queryKey: releaseKeys.changes(releaseId) });
          } else {
            queryClient.invalidateQueries({ queryKey: releaseKeys.changes(releaseId) });
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'release_reviewers',
          filter: `release_id=eq.${releaseId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: releaseKeys.reviewers(releaseId) });
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `release_id=eq.${releaseId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: releaseKeys.comments(releaseId) });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [releaseId, queryClient]);
}
