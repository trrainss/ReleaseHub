import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabase';
import { releaseKeys } from '@/shared/lib/queryKeys';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Maximum number of processed event keys kept in memory.
// Prevents unbounded growth on long-lived tabs while being generous
// enough not to drop legitimate duplicates.
const MAX_DEDUP_KEYS = 500;

interface RealtimeResult {
  /** True if the release was deleted by another session. */
  deletedRemotely: boolean;
  /** Reset the deletion flag after navigation handled it. */
  resetDeleted: () => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Subscribes to Postgres realtime changes for a single release.
 * Accepts a nullable releaseId: if undefined, no subscription is created.
 * Deduplication key includes table + event type + primary key + commit timestamp,
 * so two different rows from the same transaction are both processed.
 */
export function useRealtimeRelease(releaseId: string | undefined): RealtimeResult {
  const queryClient = useQueryClient();
  const processedKeys = useRef<Set<string>>(new Set());
  const [deletedRemotely, setDeletedRemotely] = useState(false);

  const resetDeleted = useCallback(() => {
    setDeletedRemotely(false);
  }, []);

  const markProcessed = useCallback((key: string): boolean => {
    const set = processedKeys.current;
    if (set.has(key)) return true;
    set.add(key);
    // Bound the set size: drop oldest entries when it grows too large.
    if (set.size > MAX_DEDUP_KEYS) {
      const oldest = set.values().next().value;
      if (oldest !== undefined) set.delete(oldest);
    }
    return false;
  }, []);

  useEffect(() => {
    if (!releaseId) return;

    // Clear dedup set when switching releases to avoid stale keys
    processedKeys.current.clear();

    const isDuplicate = (table: string, payload: RealtimePostgresChangesPayload<Record<string, unknown>>): boolean => {
      const commitTs = (payload.commit_timestamp as string) ?? '';
      const record = payload.new && isRecord(payload.new) ? payload.new : (payload.old as Record<string, unknown> | undefined);
      const id = record && typeof record.id === 'string' ? record.id : 'unknown';
      const key = `${table}:${payload.eventType}:${id}:${commitTs}`;
      return markProcessed(key);
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
          // Handle deletion: signal the page so it can navigate away.
          if (payload.eventType === 'DELETE') {
            setDeletedRemotely(true);
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
    };
  }, [releaseId, queryClient, markProcessed]);

  return { deletedRemotely, resetDeleted };
}
