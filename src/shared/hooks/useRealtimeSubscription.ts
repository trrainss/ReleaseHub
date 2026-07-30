import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { releaseKeys } from '@/shared/lib/queryKeys';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export function useRealtimeRelease(releaseId: string) {
  const queryClient = useQueryClient();
  const lastEventTimestamps = useRef<Record<string, string>>({});

  useEffect(() => {
    // Deduplicate events: skip if we've already processed this commit timestamp
    const isDuplicate = (table: string, payload: RealtimePostgresChangesPayload<Record<string, unknown>>): boolean => {
      const commitTs = (payload.commit_timestamp as string) ?? '';
      const key = `${table}:${commitTs}`;
      if (commitTs && lastEventTimestamps.current[key]) {
        return true;
      }
      if (commitTs) {
        lastEventTimestamps.current[key] = commitTs;
      }
      return false;
    };

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
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (isDuplicate('releases', payload)) return;
          // Handle deletion: if the release was deleted, navigate away
          if (payload.eventType === 'DELETE') {
            queryClient.removeQueries({ queryKey: releaseKeys.detail(releaseId) });
            queryClient.removeQueries({ queryKey: releaseKeys.changes(releaseId) });
            queryClient.removeQueries({ queryKey: releaseKeys.reviewers(releaseId) });
            queryClient.removeQueries({ queryKey: releaseKeys.comments(releaseId) });
            queryClient.removeQueries({ queryKey: releaseKeys.activity(releaseId) });
            return;
          }
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
          if (isDuplicate('release_changes', payload)) return;
          queryClient.invalidateQueries({ queryKey: releaseKeys.changes(releaseId) });
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
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (isDuplicate('release_reviewers', payload)) return;
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
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          if (isDuplicate('comments', payload)) return;
          queryClient.invalidateQueries({ queryKey: releaseKeys.comments(releaseId) });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      lastEventTimestamps.current = {};
    };
  }, [releaseId, queryClient]);
}
