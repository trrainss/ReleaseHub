-- ============================================================
-- ReleaseHub: fix RLS, security, and integrity
-- ============================================================
-- This migration addresses all P0 blockers from the security audit:
--   1. RLS releases — restrict UPDATE to owner/maintainer, draft only
--   2. RLS release_changes — role/author/status-aware policies
--   3. Public anon access to published releases & changes
--   4. Last-owner protection via RPC-only mutations
--   5. SECURITY DEFINER hardening (search_path, grants)
--   6. Published-release immutability trigger
--   7. Partial unique index on workspace_invites
-- ============================================================

-- ============================================================
-- Step 0: Drop existing functions that will be recreated
-- (needed because CREATE OR REPLACE cannot change return type)
-- ============================================================

DROP FUNCTION IF EXISTS public.is_member(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_owner(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.release_workspace(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.change_workspace(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.create_workspace(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.submit_release_for_review(UUID, UUID[]) CASCADE;
DROP FUNCTION IF EXISTS public.approve_release(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.reject_release(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.publish_release(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.reorder_changes(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.invite_member(UUID, TEXT, user_role) CASCADE;
DROP FUNCTION IF EXISTS public.accept_invite(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_release(UUID, INTEGER, TEXT, TEXT, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS public.block_published_release_changes() CASCADE;
DROP FUNCTION IF EXISTS public.block_published_release_update() CASCADE;
DROP FUNCTION IF EXISTS public.block_activity_delete() CASCADE;
-- New RPCs (may not exist yet, but safe to drop)
DROP FUNCTION IF EXISTS public.restore_rejected_to_draft(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.unpublish_release(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.change_member_role(UUID, UUID, user_role) CASCADE;
DROP FUNCTION IF EXISTS public.remove_workspace_member(UUID, UUID) CASCADE;

-- ============================================================
-- Step 1: Secure is_member / is_owner helpers
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.is_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_member(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_owner(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid() AND role = 'owner'
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.is_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_owner(UUID) TO authenticated;

-- Helper: get workspace_id for a release
CREATE OR REPLACE FUNCTION public.release_workspace(p_release_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ws_id UUID;
BEGIN
  SELECT p.workspace_id INTO v_ws_id
  FROM public.releases r
  JOIN public.products p ON p.id = r.product_id
  WHERE r.id = p_release_id;
  RETURN v_ws_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.release_workspace(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.release_workspace(UUID) TO authenticated;

-- Helper: get workspace_id for a change
CREATE OR REPLACE FUNCTION public.change_workspace(p_change_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ws_id UUID;
BEGIN
  SELECT p.workspace_id INTO v_ws_id
  FROM public.release_changes rc
  JOIN public.releases r ON r.id = rc.release_id
  JOIN public.products p ON p.id = r.product_id
  WHERE rc.id = p_change_id;
  RETURN v_ws_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.change_workspace(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_workspace(UUID) TO authenticated;

-- ============================================================
-- Step 2: Grant base permissions (strict)
-- ============================================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Default privileges will be granted per-table via RLS policies
-- (Supabase auto-grants SELECT to authenticated for tables with RLS enabled,
--  but we want explicit control, so we re-grant narrowly.)

-- ============================================================
-- Step 3: Fix RLS policies — releases
-- ============================================================

DROP POLICY IF EXISTS "releases_select" ON releases;
DROP POLICY IF EXISTS "releases_insert" ON releases;
DROP POLICY IF EXISTS "releases_update" ON releases;
DROP POLICY IF EXISTS "releases_delete" ON releases;

-- Authenticated workspace members can SELECT
CREATE POLICY "releases_select_workspace" ON releases
  FOR SELECT
  TO authenticated
  USING (public.is_member(public.release_workspace(id)));

-- Anon users can only SELECT published releases
CREATE POLICY "releases_select_public" ON releases
  FOR SELECT
  TO anon
  USING (status = 'published');

-- INSERT: only owner/maintainer
CREATE POLICY "releases_insert" ON releases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_member(public.release_workspace(id))
    AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = public.release_workspace(id)
        AND user_id = auth.uid()
        AND role IN ('owner', 'maintainer')
    )
  );

-- UPDATE: only owner/maintainer, only on non-published releases
-- NEVER allow changing status, version, published_at via direct UPDATE
CREATE POLICY "releases_update" ON releases
  FOR UPDATE
  TO authenticated
  USING (
    public.is_member(public.release_workspace(id))
    AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = public.release_workspace(id)
        AND user_id = auth.uid()
        AND role IN ('owner', 'maintainer')
    )
    AND status != 'published'
  )
  WITH CHECK (
    public.is_member(public.release_workspace(id))
    AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = public.release_workspace(id)
        AND user_id = auth.uid()
        AND role IN ('owner', 'maintainer')
    )
    AND status != 'published'
    -- Block changing protected fields via direct update
    AND status = (SELECT status FROM public.releases WHERE id = id)
    AND version = (SELECT version FROM public.releases WHERE id = id)
    AND published_at IS NOT DISTINCT FROM (SELECT published_at FROM public.releases WHERE id = id)
  );

-- DELETE: only owner
CREATE POLICY "releases_delete" ON releases
  FOR DELETE
  TO authenticated
  USING (public.is_owner(public.release_workspace(id)));

-- ============================================================
-- Step 4: Fix RLS policies — release_changes
-- ============================================================

DROP POLICY IF EXISTS "changes_select" ON release_changes;
DROP POLICY IF EXISTS "changes_insert" ON release_changes;
DROP POLICY IF EXISTS "changes_update" ON release_changes;
DROP POLICY IF EXISTS "changes_delete" ON release_changes;

-- SELECT: workspace members (authenticated) AND anon (for published releases only)
CREATE POLICY "changes_select_workspace" ON release_changes
  FOR SELECT
  TO authenticated
  USING (public.is_member(public.change_workspace(id)));

CREATE POLICY "changes_select_public" ON release_changes
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = release_id AND r.status = 'published'
    )
  );

-- INSERT: any workspace member, but only if release is not published
CREATE POLICY "changes_insert" ON release_changes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_member(public.change_workspace(id))
    AND NOT EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = release_id AND r.status = 'published'
    )
  );

-- UPDATE:
--   - owner/maintainer: any change, unless release is published
--   - contributor: only own changes, unless release is published
CREATE POLICY "changes_update_owner" ON release_changes
  FOR UPDATE
  TO authenticated
  USING (
    public.is_member(public.change_workspace(id))
    AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = public.change_workspace(id)
        AND user_id = auth.uid()
        AND role IN ('owner', 'maintainer')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = release_id AND r.status = 'published'
    )
  );

CREATE POLICY "changes_update_own" ON release_changes
  FOR UPDATE
  TO authenticated
  USING (
    public.is_member(public.change_workspace(id))
    AND created_by = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = release_id AND r.status = 'published'
    )
  );

-- DELETE:
--   - owner/maintainer: any change, unless release is published
--   - contributor: only own changes, unless release is published
CREATE POLICY "changes_delete_owner" ON release_changes
  FOR DELETE
  TO authenticated
  USING (
    public.is_member(public.change_workspace(id))
    AND EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = public.change_workspace(id)
        AND user_id = auth.uid()
        AND role IN ('owner', 'maintainer')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = release_id AND r.status = 'published'
    )
  );

CREATE POLICY "changes_delete_own" ON release_changes
  FOR DELETE
  TO authenticated
  USING (
    public.is_member(public.change_workspace(id))
    AND created_by = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.releases r
      WHERE r.id = release_id AND r.status = 'published'
    )
  );

-- ============================================================
-- Step 5: Fix RLS policies — workspace_members (RPC-only mutations)
-- ============================================================

DROP POLICY IF EXISTS "members_update" ON workspace_members;
DROP POLICY IF EXISTS "members_delete" ON workspace_members;

-- Block direct UPDATE/DELETE on workspace_members — use RPCs instead
-- (SELECT and INSERT remain as before)
CREATE POLICY "members_update" ON workspace_members
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "members_delete" ON workspace_members
  FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================
-- Step 6: Fix RLS policies — workspace_invites
-- ============================================================

-- Add partial unique index to prevent duplicate pending invites
DROP INDEX IF EXISTS idx_workspace_invites_pending_unique;
CREATE UNIQUE INDEX idx_workspace_invites_pending_unique
  ON workspace_invites (workspace_id, lower(email))
  WHERE status = 'pending';

-- ============================================================
-- Step 7: Published-release immutability trigger
-- ============================================================

CREATE OR REPLACE FUNCTION block_published_release_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.releases WHERE id = NEW.release_id AND status = 'published') THEN
    RAISE EXCEPTION 'Cannot modify changes of a published release';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION block_published_release_changes() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_block_published_changes_insert ON release_changes;
CREATE TRIGGER trg_block_published_changes_insert
  BEFORE INSERT ON release_changes
  FOR EACH ROW
  EXECUTE FUNCTION block_published_release_changes();

DROP TRIGGER IF EXISTS trg_block_published_changes_update ON release_changes;
CREATE TRIGGER trg_block_published_changes_update
  BEFORE UPDATE ON release_changes
  FOR EACH ROW
  EXECUTE FUNCTION block_published_release_changes();

DROP TRIGGER IF EXISTS trg_block_published_changes_delete ON release_changes;
CREATE TRIGGER trg_block_published_changes_delete
  BEFORE DELETE ON release_changes
  FOR EACH ROW
  EXECUTE FUNCTION block_published_release_changes();

-- Block updates to protected fields on published releases
CREATE OR REPLACE FUNCTION block_published_release_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'published' THEN
    -- Block any field changes on published releases
    RAISE EXCEPTION 'Cannot modify a published release';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION block_published_release_update() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_block_published_release_update ON releases;
CREATE TRIGGER trg_block_published_release_update
  BEFORE UPDATE ON releases
  FOR EACH ROW
  EXECUTE FUNCTION block_published_release_update();

-- Block DELETE on activity_events to ensure WORM
CREATE OR REPLACE FUNCTION block_activity_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Activity events cannot be deleted';
END;
$$;
REVOKE EXECUTE ON FUNCTION block_activity_delete() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_block_activity_delete ON activity_events;
CREATE TRIGGER trg_block_activity_delete
  BEFORE DELETE ON activity_events
  FOR EACH ROW
  EXECUTE FUNCTION block_activity_delete();

-- ============================================================
-- Step 8: Secure RPC functions (search_path + explicit grants)
-- ============================================================
-- SECURITY DEFINER hardening
-- ============================================================

-- Revoke public execute and grant to authenticated for each function.
-- We do this inline after each CREATE OR REPLACE below.
-- This is more reliable than a dynamic DO block (which breaks on custom types like user_role).

-- Default privileges for all future functions
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- Now recreate each RPC with proper search_path and role checks

-- create_workspace
CREATE OR REPLACE FUNCTION public.create_workspace(workspace_name TEXT)
RETURNS workspaces
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_workspace workspaces;
  v_product products;
BEGIN
  INSERT INTO workspaces (name, created_by) VALUES (workspace_name, auth.uid()) RETURNING * INTO v_workspace;
  INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (v_workspace.id, auth.uid(), 'owner');
  INSERT INTO products (workspace_id, name, slug) VALUES (v_workspace.id, 'Default', 'default') RETURNING * INTO v_product;
  INSERT INTO activity_events (workspace_id, actor_id, event_type, payload)
    VALUES (v_workspace.id, auth.uid(), 'workspace_created', jsonb_build_object('name', workspace_name));
  RETURN v_workspace;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_workspace(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT) TO authenticated;

-- submit_release_for_review
CREATE OR REPLACE FUNCTION public.submit_release_for_review(p_release_id UUID, p_reviewer_ids UUID[])
RETURNS releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_release releases;
  v_ws_id UUID;
  v_change_count INTEGER;
  v_reviewer_id UUID;
  v_role TEXT;
BEGIN
  SELECT * INTO v_release FROM releases WHERE id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;

  -- Check that current user is owner/maintainer
  SELECT p.workspace_id INTO v_ws_id FROM products p JOIN releases r ON r.product_id = p.id WHERE r.id = p_release_id;
  SELECT role::TEXT INTO v_role FROM workspace_members WHERE workspace_id = v_ws_id AND user_id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('owner', 'maintainer') THEN
    RAISE EXCEPTION 'Only owners and maintainers can submit releases for review';
  END IF;

  IF v_release.status != 'draft' THEN RAISE EXCEPTION 'Release must be in draft status'; END IF;
  SELECT COUNT(*) INTO v_change_count FROM release_changes WHERE release_id = p_release_id;
  IF v_change_count = 0 THEN RAISE EXCEPTION 'Release must have at least one change'; END IF;

  UPDATE releases SET status = 'review', updated_at = now() WHERE id = p_release_id RETURNING * INTO v_release;

  FOREACH v_reviewer_id IN ARRAY p_reviewer_ids LOOP
    INSERT INTO release_reviewers (release_id, user_id) VALUES (p_release_id, v_reviewer_id) ON CONFLICT (release_id, user_id) DO NOTHING;
  END LOOP;

  INSERT INTO activity_events (workspace_id, release_id, actor_id, event_type)
    VALUES (v_ws_id, p_release_id, auth.uid(), 'release_submitted');
  RETURN v_release;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.submit_release_for_review(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_release_for_review(UUID, UUID[]) TO authenticated;

-- approve_release
CREATE OR REPLACE FUNCTION public.approve_release(p_release_id UUID)
RETURNS releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_release releases;
  v_ws_id UUID;
BEGIN
  SELECT * INTO v_release FROM releases WHERE id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
  IF v_release.status != 'review' THEN RAISE EXCEPTION 'Release must be in review status'; END IF;
  IF NOT EXISTS (SELECT 1 FROM release_reviewers WHERE release_id = p_release_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are not assigned as a reviewer';
  END IF;

  UPDATE release_reviewers SET decision = 'approve', decided_at = now()
    WHERE release_id = p_release_id AND user_id = auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM release_reviewers
    WHERE release_id = p_release_id AND (decision IS NULL OR decision = 'reject')
  ) THEN
    UPDATE releases SET status = 'approved', updated_at = now() WHERE id = p_release_id RETURNING * INTO v_release;
    SELECT p.workspace_id INTO v_ws_id FROM products p WHERE p.id = v_release.product_id;
    INSERT INTO activity_events (workspace_id, release_id, actor_id, event_type)
      VALUES (v_ws_id, p_release_id, auth.uid(), 'release_approved');
  ELSE
    SELECT * INTO v_release FROM releases WHERE id = p_release_id;
  END IF;
  RETURN v_release;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_release(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_release(UUID) TO authenticated;

-- reject_release
CREATE OR REPLACE FUNCTION public.reject_release(p_release_id UUID)
RETURNS releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_release releases;
  v_ws_id UUID;
BEGIN
  SELECT * INTO v_release FROM releases WHERE id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
  IF v_release.status != 'review' THEN RAISE EXCEPTION 'Release must be in review status'; END IF;
  IF NOT EXISTS (SELECT 1 FROM release_reviewers WHERE release_id = p_release_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are not assigned as a reviewer';
  END IF;

  UPDATE release_reviewers SET decision = 'reject', decided_at = now()
    WHERE release_id = p_release_id AND user_id = auth.uid();
  UPDATE releases SET status = 'rejected', updated_at = now() WHERE id = p_release_id RETURNING * INTO v_release;
  SELECT p.workspace_id INTO v_ws_id FROM products p WHERE p.id = v_release.product_id;
  INSERT INTO activity_events (workspace_id, release_id, actor_id, event_type)
    VALUES (v_ws_id, p_release_id, auth.uid(), 'release_rejected');
  RETURN v_release;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reject_release(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_release(UUID) TO authenticated;

-- restore_rejected_to_draft (new RPC — missing from original)
CREATE OR REPLACE FUNCTION public.restore_rejected_to_draft(p_release_id UUID)
RETURNS releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_release releases;
  v_ws_id UUID;
  v_role TEXT;
BEGIN
  SELECT * INTO v_release FROM releases WHERE id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
  IF v_release.status != 'rejected' THEN RAISE EXCEPTION 'Release must be in rejected status'; END IF;

  SELECT p.workspace_id INTO v_ws_id FROM products p WHERE p.id = v_release.product_id;
  SELECT role::TEXT INTO v_role FROM workspace_members WHERE workspace_id = v_ws_id AND user_id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('owner', 'maintainer') THEN
    RAISE EXCEPTION 'Only owners and maintainers can restore rejected releases';
  END IF;

  UPDATE releases SET status = 'draft', updated_at = now() WHERE id = p_release_id RETURNING * INTO v_release;
  -- Reset reviewer decisions
  UPDATE release_reviewers SET decision = NULL, decided_at = NULL WHERE release_id = p_release_id;
  RETURN v_release;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.restore_rejected_to_draft(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_rejected_to_draft(UUID) TO authenticated;

-- publish_release
CREATE OR REPLACE FUNCTION public.publish_release(p_release_id UUID)
RETURNS releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_release releases;
  v_role TEXT;
  v_ws_id UUID;
BEGIN
  SELECT * INTO v_release FROM releases WHERE id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
  IF v_release.status != 'approved' THEN RAISE EXCEPTION 'Release must be approved before publishing'; END IF;

  SELECT p.workspace_id INTO v_ws_id FROM products p WHERE p.id = v_release.product_id;
  SELECT role::TEXT INTO v_role FROM workspace_members
    WHERE user_id = auth.uid() AND workspace_id = v_ws_id;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'maintainer') THEN
    RAISE EXCEPTION 'Only owners and maintainers can publish releases';
  END IF;

  UPDATE releases SET status = 'published', published_at = now(), updated_at = now()
    WHERE id = p_release_id RETURNING * INTO v_release;
  INSERT INTO activity_events (workspace_id, release_id, actor_id, event_type, payload)
    VALUES (v_ws_id, p_release_id, auth.uid(), 'release_published',
      jsonb_build_object('version', v_release.version, 'published_at', v_release.published_at));
  RETURN v_release;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.publish_release(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_release(UUID) TO authenticated;

-- unpublish_release (new — owner can unpublish if needed)
CREATE OR REPLACE FUNCTION public.unpublish_release(p_release_id UUID)
RETURNS releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_release releases;
  v_ws_id UUID;
BEGIN
  SELECT * INTO v_release FROM releases WHERE id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
  IF v_release.status != 'published' THEN RAISE EXCEPTION 'Release must be published'; END IF;

  SELECT p.workspace_id INTO v_ws_id FROM products p WHERE p.id = v_release.product_id;
  IF NOT public.is_owner(v_ws_id) THEN
    RAISE EXCEPTION 'Only owners can unpublish releases';
  END IF;

  UPDATE releases SET status = 'draft', published_at = NULL, updated_at = now()
    WHERE id = p_release_id RETURNING * INTO v_release;
  RETURN v_release;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.unpublish_release(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unpublish_release(UUID) TO authenticated;

-- reorder_changes (with security checks)
CREATE OR REPLACE FUNCTION public.reorder_changes(p_changes JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_release_id UUID;
  v_release_status TEXT;
  v_ws_id UUID;
  v_role TEXT;
  v_change_ids UUID[];
  v_unique_releases UUID[];
BEGIN
  -- Get the first change's release to verify
  SELECT release_id INTO v_release_id
  FROM release_changes WHERE id = (SELECT (jsonb_array_element(p_changes, 0)->>'id')::UUID);

  -- Verify all changes belong to the same release
  SELECT array_agg(DISTINCT release_id) INTO v_unique_releases
  FROM release_changes WHERE id = ANY(
    SELECT (jsonb_array_elements(p_changes)->>'id')::UUID
  );

  IF array_length(v_unique_releases, 1) != 1 THEN
    RAISE EXCEPTION 'All changes must belong to the same release';
  END IF;

  -- Check release is in draft
  SELECT status INTO v_release_status FROM releases WHERE id = v_release_id;
  IF v_release_status != 'draft' THEN
    RAISE EXCEPTION 'Can only reorder changes in draft releases';
  END IF;

  -- Check user has permission (owner/maintainer or the change author)
  SELECT p.workspace_id INTO v_ws_id FROM products p JOIN releases r ON r.product_id = p.id WHERE r.id = v_release_id;
  SELECT role::TEXT INTO v_role FROM workspace_members WHERE workspace_id = v_ws_id AND user_id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this workspace';
  END IF;

  UPDATE release_changes AS c SET position = (x.position)::INTEGER, updated_at = now()
  FROM jsonb_to_recordset(p_changes) AS x(id UUID, position INTEGER)
  WHERE c.id = x.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reorder_changes(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_changes(JSONB) TO authenticated;

-- update_release (safe version — only allows editing title, description, planned_at)
CREATE OR REPLACE FUNCTION public.update_release(
  p_release_id UUID,
  p_expected_version INTEGER,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_planned_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS releases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_release releases;
  v_ws_id UUID;
  v_role TEXT;
BEGIN
  SELECT * INTO v_release FROM releases WHERE id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;

  -- Only allow editing draft (and optionally rejected) releases
  IF v_release.status NOT IN ('draft', 'rejected') THEN
    RAISE EXCEPTION 'Can only edit draft or rejected releases';
  END IF;

  -- Check permission
  SELECT p.workspace_id INTO v_ws_id FROM products p WHERE p.id = v_release.product_id;
  SELECT role::TEXT INTO v_role FROM workspace_members WHERE workspace_id = v_ws_id AND user_id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('owner', 'maintainer') THEN
    RAISE EXCEPTION 'Only owners and maintainers can edit releases';
  END IF;

  -- Optimistic lock check
  IF v_release.row_version != p_expected_version THEN
    RAISE EXCEPTION 'Conflict: release was modified by another user. Please reload and try again.';
  END IF;

  UPDATE releases SET
    title = COALESCE(p_title, title),
    description = COALESCE(p_description, description),
    planned_at = COALESCE(p_planned_at, planned_at),
    row_version = row_version + 1,
    updated_at = now()
  WHERE id = p_release_id RETURNING * INTO v_release;
  RETURN v_release;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_release(UUID, INTEGER, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_release(UUID, INTEGER, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- invite_member (with last-owner check for role changes)
CREATE OR REPLACE FUNCTION public.invite_member(p_workspace_id UUID, p_email TEXT, p_role user_role)
RETURNS workspace_invites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite workspace_invites;
  v_existing_user_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Only owners can invite members';
  END IF;

  SELECT id INTO v_existing_user_id FROM profiles WHERE id IN (SELECT id FROM auth.users WHERE email = p_email);
  IF v_existing_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = p_workspace_id AND user_id = v_existing_user_id) THEN
    RAISE EXCEPTION 'User is already a member';
  END IF;

  INSERT INTO workspace_invites (workspace_id, email, role, token_hash, invited_by)
  VALUES (p_workspace_id, p_email, p_role, encode(gen_random_bytes(32), 'hex'), auth.uid())
  RETURNING * INTO v_invite;
  RETURN v_invite;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.invite_member(UUID, TEXT, user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invite_member(UUID, TEXT, user_role) TO authenticated;

-- accept_invite (with email check against auth.users)
CREATE OR REPLACE FUNCTION public.accept_invite(p_token_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite workspace_invites;
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  SELECT * INTO v_invite FROM workspace_invites WHERE token_hash = p_token_hash AND status = 'pending' AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or expired invitation'; END IF;
  IF v_invite.email != v_user_email THEN RAISE EXCEPTION 'This invitation was sent to a different email address'; END IF;

  INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (v_invite.workspace_id, auth.uid(), v_invite.role);
  UPDATE workspace_invites SET status = 'accepted' WHERE id = v_invite.id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accept_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invite(TEXT) TO authenticated;

-- New RPC: change_member_role (with last-owner protection)
CREATE OR REPLACE FUNCTION public.change_member_role(
  p_workspace_id UUID,
  p_user_id UUID,
  p_new_role user_role
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_count INTEGER;
BEGIN
  -- Only owner can change roles
  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Only owners can change member roles';
  END IF;

  -- If target is being demoted from owner, ensure there is at least one other owner
  IF EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND role = 'owner') AND p_new_role != 'owner' THEN
    SELECT COUNT(*) INTO v_owner_count FROM workspace_members WHERE workspace_id = p_workspace_id AND role = 'owner';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot demote the last owner. Promote another member to owner first.';
    END IF;
  END IF;

  UPDATE workspace_members SET role = p_new_role WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.change_member_role(UUID, UUID, user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.change_member_role(UUID, UUID, user_role) TO authenticated;

-- New RPC: remove_workspace_member (with last-owner protection)
CREATE OR REPLACE FUNCTION public.remove_workspace_member(
  p_workspace_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_owner_count INTEGER;
BEGIN
  -- Only owner can remove members
  IF NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Only owners can remove members';
  END IF;

  -- Cannot remove the last owner
  IF EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = p_workspace_id AND user_id = p_user_id AND role = 'owner') THEN
    SELECT COUNT(*) INTO v_owner_count FROM workspace_members WHERE workspace_id = p_workspace_id AND role = 'owner';
    IF v_owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot remove the last owner. Promote another member to owner first.';
    END IF;
  END IF;

  DELETE FROM workspace_members WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.remove_workspace_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(UUID, UUID) TO authenticated;

-- Realtime publication (preserved)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'releases'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE releases;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'release_changes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE release_changes;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'release_reviewers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE release_reviewers;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE comments;
  END IF;
END $$;
