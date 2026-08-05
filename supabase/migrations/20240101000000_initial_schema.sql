-- ============================================================
-- ReleaseHub: complete schema, RLS, RPCs
-- ============================================================

-- Step 1: enums
-- (use IF NOT EXISTS because the SQL Editor may run in multiple sessions)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('owner', 'maintainer', 'contributor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE release_status AS ENUM ('draft', 'review', 'approved', 'rejected', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE change_category AS ENUM ('feature', 'improvement', 'bugfix', 'security', 'breaking');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE event_type AS ENUM (
    'workspace_created', 'release_created', 'release_submitted',
    'release_approved', 'release_rejected', 'release_published',
    'member_added', 'member_removed', 'role_changed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: tables

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'contributor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'contributor',
  token_hash TEXT NOT NULL UNIQUE,
  status invite_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  invited_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, slug)
);

CREATE TABLE IF NOT EXISTS releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status release_status NOT NULL DEFAULT 'draft',
  planned_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  row_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS release_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category change_category NOT NULL,
  position INTEGER NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS release_reviewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  decision TEXT CHECK (decision IN ('approve', 'reject')),
  decided_at TIMESTAMPTZ,
  UNIQUE(release_id, user_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  release_id UUID REFERENCES releases(id) ON DELETE SET NULL,
  actor_id UUID NOT NULL REFERENCES profiles(id),
  event_type event_type NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 3: auth trigger – creates profile on signup (no RLS bypass needed)

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Step 4: RLS helper functions (SECURITY DEFINER bypasses RLS on workspace_members)

CREATE OR REPLACE FUNCTION public.is_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = ws_id AND user_id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.is_owner(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = ws_id AND user_id = auth.uid() AND role = 'owner');
END;
$$;

-- Step 5: RLS enable

ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS release_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS release_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS activity_events ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS policies

-- Grant base permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "workspaces_select" ON workspaces;
DROP POLICY IF EXISTS "workspaces_insert" ON workspaces;
DROP POLICY IF EXISTS "workspaces_update" ON workspaces;
DROP POLICY IF EXISTS "workspaces_delete" ON workspaces;
CREATE POLICY "workspaces_select" ON workspaces FOR SELECT USING (public.is_member(id));
CREATE POLICY "workspaces_insert" ON workspaces FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "workspaces_update" ON workspaces FOR UPDATE USING (public.is_owner(id));
CREATE POLICY "workspaces_delete" ON workspaces FOR DELETE USING (public.is_owner(id));

DROP POLICY IF EXISTS "members_select" ON workspace_members;
DROP POLICY IF EXISTS "members_insert" ON workspace_members;
DROP POLICY IF EXISTS "members_update" ON workspace_members;
DROP POLICY IF EXISTS "members_delete" ON workspace_members;
CREATE POLICY "members_select" ON workspace_members FOR SELECT USING (public.is_member(workspace_id));
CREATE POLICY "members_insert" ON workspace_members FOR INSERT WITH CHECK (public.is_owner(workspace_id));
CREATE POLICY "members_update" ON workspace_members FOR UPDATE USING (public.is_owner(workspace_id));
CREATE POLICY "members_delete" ON workspace_members FOR DELETE USING (public.is_owner(workspace_id));

DROP POLICY IF EXISTS "invites_select" ON workspace_invites;
DROP POLICY IF EXISTS "invites_insert" ON workspace_invites;
DROP POLICY IF EXISTS "invites_update" ON workspace_invites;
DROP POLICY IF EXISTS "invites_delete" ON workspace_invites;
CREATE POLICY "invites_select" ON workspace_invites FOR SELECT USING (public.is_member(workspace_id));
CREATE POLICY "invites_insert" ON workspace_invites FOR INSERT WITH CHECK (public.is_owner(workspace_id));
CREATE POLICY "invites_update" ON workspace_invites FOR UPDATE USING (public.is_owner(workspace_id));
CREATE POLICY "invites_delete" ON workspace_invites FOR DELETE USING (public.is_owner(workspace_id));

DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;
CREATE POLICY "products_select" ON products FOR SELECT USING (public.is_member(workspace_id));
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (public.is_owner(workspace_id));
CREATE POLICY "products_update" ON products FOR UPDATE USING (public.is_owner(workspace_id));
CREATE POLICY "products_delete" ON products FOR DELETE USING (public.is_owner(workspace_id));

DROP POLICY IF EXISTS "releases_select" ON releases;
DROP POLICY IF EXISTS "releases_insert" ON releases;
DROP POLICY IF EXISTS "releases_update" ON releases;
DROP POLICY IF EXISTS "releases_delete" ON releases;
CREATE POLICY "releases_select" ON releases FOR SELECT USING (public.is_member((SELECT workspace_id FROM products WHERE id = product_id)));
CREATE POLICY "releases_insert" ON releases FOR INSERT WITH CHECK (
  public.is_member((SELECT workspace_id FROM products WHERE id = product_id))
  AND EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = (SELECT workspace_id FROM products WHERE id = product_id) AND user_id = auth.uid() AND role IN ('owner', 'maintainer'))
);
CREATE POLICY "releases_update" ON releases FOR UPDATE USING (public.is_member((SELECT workspace_id FROM products WHERE id = product_id)));
CREATE POLICY "releases_delete" ON releases FOR DELETE USING (public.is_owner((SELECT workspace_id FROM products WHERE id = product_id)));

DROP POLICY IF EXISTS "changes_select" ON release_changes;
DROP POLICY IF EXISTS "changes_insert" ON release_changes;
DROP POLICY IF EXISTS "changes_update" ON release_changes;
DROP POLICY IF EXISTS "changes_delete" ON release_changes;
CREATE POLICY "changes_select" ON release_changes FOR SELECT USING (public.is_member((SELECT p.workspace_id FROM products p JOIN releases r ON r.product_id = p.id WHERE r.id = release_id)));
CREATE POLICY "changes_insert" ON release_changes FOR INSERT WITH CHECK (public.is_member((SELECT p.workspace_id FROM products p JOIN releases r ON r.product_id = p.id WHERE r.id = release_id)));
CREATE POLICY "changes_update" ON release_changes FOR UPDATE USING (public.is_member((SELECT p.workspace_id FROM products p JOIN releases r ON r.product_id = p.id WHERE r.id = release_id)));
CREATE POLICY "changes_delete" ON release_changes FOR DELETE USING (public.is_member((SELECT p.workspace_id FROM products p JOIN releases r ON r.product_id = p.id WHERE r.id = release_id)));

DROP POLICY IF EXISTS "reviewers_select" ON release_reviewers;
DROP POLICY IF EXISTS "reviewers_insert" ON release_reviewers;
DROP POLICY IF EXISTS "reviewers_update_self" ON release_reviewers;
CREATE POLICY "reviewers_select" ON release_reviewers FOR SELECT USING (public.is_member((SELECT p.workspace_id FROM products p JOIN releases r ON r.product_id = p.id WHERE r.id = release_id)));
CREATE POLICY "reviewers_insert" ON release_reviewers FOR INSERT WITH CHECK (
  public.is_member((SELECT p.workspace_id FROM products p JOIN releases r ON r.product_id = p.id WHERE r.id = release_id))
  AND EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = (SELECT p.workspace_id FROM products p JOIN releases r ON r.product_id = p.id WHERE r.id = release_id) AND user_id = auth.uid() AND role IN ('owner', 'maintainer'))
);
CREATE POLICY "reviewers_update_self" ON release_reviewers FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "comments_select" ON comments;
DROP POLICY IF EXISTS "comments_insert" ON comments;
DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_select" ON comments FOR SELECT USING (public.is_member((SELECT p.workspace_id FROM products p JOIN releases r ON r.product_id = p.id WHERE r.id = release_id)));
CREATE POLICY "comments_insert" ON comments FOR INSERT WITH CHECK (public.is_member((SELECT p.workspace_id FROM products p JOIN releases r ON r.product_id = p.id WHERE r.id = release_id)));
CREATE POLICY "comments_delete" ON comments FOR DELETE USING (user_id = auth.uid() OR public.is_owner((SELECT p.workspace_id FROM products p JOIN releases r ON r.product_id = p.id WHERE r.id = release_id)));

DROP POLICY IF EXISTS "activity_select" ON activity_events;
CREATE POLICY "activity_select" ON activity_events FOR SELECT USING (public.is_member(workspace_id));

-- Step 7: RPC functions

CREATE OR REPLACE FUNCTION create_workspace(workspace_name TEXT)
RETURNS workspaces
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_workspace workspaces;
  v_product products;
BEGIN
  INSERT INTO workspaces (name, created_by) VALUES (workspace_name, auth.uid()) RETURNING * INTO v_workspace;
  INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (v_workspace.id, auth.uid(), 'owner');
  INSERT INTO products (workspace_id, name, slug) VALUES (v_workspace.id, 'Default', 'default') RETURNING * INTO v_product;
  INSERT INTO activity_events (workspace_id, actor_id, event_type, payload) VALUES (v_workspace.id, auth.uid(), 'workspace_created', jsonb_build_object('name', workspace_name));
  RETURN v_workspace;
END;
$$;

CREATE OR REPLACE FUNCTION submit_release_for_review(p_release_id UUID, p_reviewer_ids UUID[])
RETURNS releases
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_release releases;
  v_change_count INTEGER;
  v_reviewer_id UUID;
BEGIN
  SELECT * INTO v_release FROM releases WHERE id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
  IF v_release.status != 'draft' THEN RAISE EXCEPTION 'Release must be in draft status'; END IF;
  IF v_release.title IS NULL OR v_release.title = '' THEN RAISE EXCEPTION 'Release must have a title'; END IF;
  IF v_release.version IS NULL OR v_release.version = '' THEN RAISE EXCEPTION 'Release must have a version'; END IF;
  SELECT COUNT(*) INTO v_change_count FROM release_changes WHERE release_id = p_release_id;
  IF v_change_count = 0 THEN RAISE EXCEPTION 'Release must have at least one change'; END IF;
  IF array_length(p_reviewer_ids, 1) IS NULL OR array_length(p_reviewer_ids, 1) = 0 THEN RAISE EXCEPTION 'At least one reviewer must be assigned'; END IF;

  UPDATE releases SET status = 'review', updated_at = now() WHERE id = p_release_id RETURNING * INTO v_release;

  FOREACH v_reviewer_id IN ARRAY p_reviewer_ids LOOP
    INSERT INTO release_reviewers (release_id, user_id) VALUES (p_release_id, v_reviewer_id) ON CONFLICT (release_id, user_id) DO NOTHING;
  END LOOP;

  INSERT INTO activity_events (workspace_id, release_id, actor_id, event_type)
  VALUES ((SELECT products.workspace_id FROM products JOIN releases ON releases.product_id = products.id WHERE releases.id = p_release_id), p_release_id, auth.uid(), 'release_submitted');
  RETURN v_release;
END;
$$;

CREATE OR REPLACE FUNCTION approve_release(p_release_id UUID)
RETURNS releases
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_release releases;
BEGIN
  SELECT * INTO v_release FROM releases WHERE id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
  IF v_release.status != 'review' THEN RAISE EXCEPTION 'Release must be in review status'; END IF;
  IF NOT EXISTS (SELECT 1 FROM release_reviewers WHERE release_id = p_release_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'You are not assigned as a reviewer'; END IF;

  UPDATE release_reviewers SET decision = 'approve', decided_at = now() WHERE release_id = p_release_id AND user_id = auth.uid();

  IF NOT EXISTS (SELECT 1 FROM release_reviewers WHERE release_id = p_release_id AND (decision IS NULL OR decision = 'reject')) THEN
    UPDATE releases SET status = 'approved', updated_at = now() WHERE id = p_release_id RETURNING * INTO v_release;
    INSERT INTO activity_events (workspace_id, release_id, actor_id, event_type)
    VALUES ((SELECT products.workspace_id FROM products JOIN releases ON releases.product_id = products.id WHERE releases.id = p_release_id), p_release_id, auth.uid(), 'release_approved');
  ELSE
    SELECT * INTO v_release FROM releases WHERE id = p_release_id;
  END IF;
  RETURN v_release;
END;
$$;

CREATE OR REPLACE FUNCTION reject_release(p_release_id UUID)
RETURNS releases
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_release releases;
BEGIN
  SELECT * INTO v_release FROM releases WHERE id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
  IF v_release.status != 'review' THEN RAISE EXCEPTION 'Release must be in review status'; END IF;
  IF NOT EXISTS (SELECT 1 FROM release_reviewers WHERE release_id = p_release_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'You are not assigned as a reviewer'; END IF;

  UPDATE release_reviewers SET decision = 'reject', decided_at = now() WHERE release_id = p_release_id AND user_id = auth.uid();
  UPDATE releases SET status = 'rejected', updated_at = now() WHERE id = p_release_id RETURNING * INTO v_release;
  INSERT INTO activity_events (workspace_id, release_id, actor_id, event_type)
  VALUES ((SELECT products.workspace_id FROM products JOIN releases ON releases.product_id = products.id WHERE releases.id = p_release_id), p_release_id, auth.uid(), 'release_rejected');
  RETURN v_release;
END;
$$;

CREATE OR REPLACE FUNCTION publish_release(p_release_id UUID)
RETURNS releases
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_release releases;
  v_role user_role;
BEGIN
  SELECT * INTO v_release FROM releases WHERE id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
  IF v_release.status != 'approved' THEN RAISE EXCEPTION 'Release must be approved before publishing'; END IF;

  SELECT role INTO v_role FROM workspace_members WHERE user_id = auth.uid() AND workspace_id = (SELECT products.workspace_id FROM products WHERE id = v_release.product_id);
  IF v_role IS NULL OR v_role NOT IN ('owner', 'maintainer') THEN RAISE EXCEPTION 'Only owners and maintainers can publish releases'; END IF;

  UPDATE releases SET status = 'published', published_at = now(), updated_at = now() WHERE id = p_release_id RETURNING * INTO v_release;
  INSERT INTO activity_events (workspace_id, release_id, actor_id, event_type, payload)
  VALUES ((SELECT products.workspace_id FROM products JOIN releases ON releases.product_id = products.id WHERE releases.id = p_release_id), p_release_id, auth.uid(), 'release_published', jsonb_build_object('version', v_release.version, 'published_at', v_release.published_at));
  RETURN v_release;
END;
$$;

CREATE OR REPLACE FUNCTION reorder_changes(p_changes JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE release_changes AS c SET position = (x.position)::INTEGER, updated_at = now()
  FROM jsonb_to_recordset(p_changes) AS x(id UUID, position INTEGER)
  WHERE c.id = x.id;
END;
$$;

CREATE OR REPLACE FUNCTION invite_member(p_workspace_id UUID, p_email TEXT, p_role user_role)
RETURNS workspace_invites
LANGUAGE plpgsql
SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION accept_invite(p_token_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION update_release(
  p_release_id UUID,
  p_expected_version INTEGER,
  p_title TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_planned_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS releases
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_release releases;
BEGIN
  SELECT * INTO v_release FROM releases WHERE id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
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

CREATE OR REPLACE FUNCTION replace_release_reviewers(p_release_id UUID, p_reviewer_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_workspace_id UUID;
  v_status release_status;
BEGIN
  -- Validate caller role (owner/maintainer)
  SELECT p.workspace_id INTO v_workspace_id
  FROM products p
  JOIN releases r ON r.product_id = p.id
  WHERE r.id = p_release_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = v_workspace_id AND user_id = auth.uid() AND role IN ('owner', 'maintainer')
  ) THEN
    RAISE EXCEPTION 'Only owners and maintainers can assign reviewers';
  END IF;

  -- Lock the release row to prevent concurrent review assignment
  SELECT status INTO v_status FROM releases WHERE id = p_release_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Release not found'; END IF;
  IF v_status NOT IN ('draft', 'review') THEN
    RAISE EXCEPTION 'Reviewers can only be assigned to draft or review releases';
  END IF;

  -- Validate reviewer ids belong to workspace members
  IF EXISTS (
    SELECT 1 FROM unnest(p_reviewer_ids) AS rid
    LEFT JOIN workspace_members wm ON wm.user_id = rid AND wm.workspace_id = v_workspace_id
    WHERE wm.user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'All reviewers must be members of the workspace';
  END IF;

  -- Atomic replace in a single transaction
  DELETE FROM release_reviewers WHERE release_id = p_release_id;
  IF array_length(p_reviewer_ids, 1) IS NOT NULL THEN
    INSERT INTO release_reviewers (release_id, user_id)
    SELECT p_release_id, rid FROM unnest(p_reviewer_ids) AS rid;
  END IF;
END;
$$;

-- Step 8: Realtime

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
