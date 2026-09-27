-- =============================================================================
-- FlowDesk database schema
-- =============================================================================
-- Builds everything FlowDesk needs inside a Supabase project: types, tables,
-- indexes, functions, triggers, row level security (RLS), storage buckets,
-- realtime, and a few default settings (SLA targets and approval gates).
--
-- It creates NO users, branches, products or tickets. The default admin
-- account comes from the next file, 20260926000100_seed_admin.sql.
--
-- How to run it (pick one):
--   * Supabase dashboard: SQL Editor -> New query -> paste this whole file ->
--     Run. Then do the same with 20260926000100_seed_admin.sql.
--   * Supabase CLI (hosted project):
--       supabase link --project-ref <your-project-ref>
--       supabase db push
--   * Supabase CLI (local stack): supabase start
--     (applies every file in supabase/migrations in filename order)
--
-- Safe to run more than once. Tables are only created when missing and no data
-- is deleted. Functions, triggers and policies are re-applied, so any policy
-- you added by hand to a FlowDesk table is replaced by the set defined here.
--
-- Roles used by the app (public.user_role):
--   admin          full access, Admin panel, creates users
--   developer      works tickets, releases, knowledge base
--   support_desk   triages tickets, knowledge base, support portal
--   branch_manager sees all tickets, edits tickets of their own branch,
--                  submits requests from the support portal
--   customer       placeholder role with no screens in the app yet (users see
--                  "No Role Assigned"). In the database it can see, and
--                  comment on, tickets whose customer_email matches its
--                  profile email. It is the default for accounts not created
--                  by an admin; such accounts also start deactivated.
-- =============================================================================


-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================
-- gen_random_uuid() is built into Postgres. pgcrypto (crypt / gen_salt) is
-- only needed by the admin seed; Supabase ships it in the "extensions" schema.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


-- =============================================================================
-- 2. ENUM TYPES
-- =============================================================================
-- Each type is created once with its complete value list, so nothing has to be
-- added (and committed) later before it can be used.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'user_role'
  ) THEN
    CREATE TYPE public.user_role AS ENUM (
      'developer', 'support_desk', 'admin', 'customer', 'branch_manager'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'ticket_status'
  ) THEN
    CREATE TYPE public.ticket_status AS ENUM (
      'pending', 'planning', 'ready_for_dev', 'dev_in_progress', 'in_review',
      'beta_testing', 'done', 'sow_in_progress', 'awaiting_customer_approval',
      'rejected', 'on_hold_customer', 'on_hold_dev', 'on_hold_support',
      'on_hold_sow'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'ticket_priority'
  ) THEN
    CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'ticket_type'
  ) THEN
    CREATE TYPE public.ticket_type AS ENUM (
      'bug', 'feature_request', 'project', 'task', 'documentation',
      'improvement', 'professional_service'
    );
  END IF;
END
$$;


-- =============================================================================
-- 3. TABLES
-- =============================================================================
-- Created in foreign-key order. Foreign keys are named explicitly because the
-- frontend uses several of these names as PostgREST embed hints, e.g.
-- profiles!tickets_assigned_to_fkey.
--
-- Deleting a user (public.delete_user_officially) removes their auth.users row,
-- which cascades to public.profiles. Every other reference to a profile is
-- therefore either ON DELETE SET NULL (history is kept, the UI shows it as a
-- deleted user) or ON DELETE CASCADE (rows that mean nothing without the user,
-- such as their notifications and watch list entries).

-- Human-readable ticket numbers (FLD-0001, FLD-0002, ...).
CREATE SEQUENCE IF NOT EXISTS public.ticket_seq START 1;

-- 3.1 Branches (ids are free text chosen by the admin, e.g. "HQ-001")
CREATE TABLE IF NOT EXISTS public.branches (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.2 Profiles: one row per auth user, created by the handle_new_user trigger
CREATE TABLE IF NOT EXISTS public.profiles (
  id                   uuid PRIMARY KEY
                       CONSTRAINT profiles_id_fkey REFERENCES auth.users (id) ON DELETE CASCADE,
  email                text NOT NULL DEFAULT '',
  full_name            text,
  role                 public.user_role NOT NULL DEFAULT 'customer',
  avatar_url           text,
  company_name         text,
  phone                text,
  branch_id            text
                       CONSTRAINT profiles_branch_id_fkey REFERENCES public.branches (id) ON DELETE SET NULL,
  -- New accounts start inactive; admin-created users and the seeded admin are
  -- switched on explicitly. The app shows "Account Deactivated" when false.
  is_active            boolean NOT NULL DEFAULT false,
  force_password_reset boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- 3.3 Products (archived, never deleted)
CREATE TABLE IF NOT EXISTS public.products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  color       text DEFAULT '#3b82f6',
  status      text NOT NULL DEFAULT 'active'
              CONSTRAINT products_status_check CHECK (status IN ('active', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 3.4 Milestones (target_date is a plain date: the UI binds it to <input type="date">)
CREATE TABLE IF NOT EXISTS public.milestones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  target_date date,
  status      text NOT NULL DEFAULT 'open'
              CONSTRAINT milestones_status_check CHECK (status IN ('open', 'in_progress', 'completed')),
  product_id  uuid
              CONSTRAINT milestones_product_id_fkey REFERENCES public.products (id) ON DELETE SET NULL,
  created_by  uuid
              CONSTRAINT milestones_created_by_fkey REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 3.5 Tickets
CREATE TABLE IF NOT EXISTS public.tickets (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  readable_id             text NOT NULL CONSTRAINT tickets_readable_id_key UNIQUE,  -- set by trigger
  title                   text NOT NULL,
  description             text,
  acceptance_criteria     text,
  type                    public.ticket_type NOT NULL DEFAULT 'bug',
  priority                public.ticket_priority NOT NULL DEFAULT 'medium',
  status                  public.ticket_status NOT NULL DEFAULT 'pending',
  created_by              uuid
                          CONSTRAINT tickets_created_by_fkey REFERENCES public.profiles (id) ON DELETE SET NULL,
  assigned_to             uuid
                          CONSTRAINT tickets_assigned_to_fkey REFERENCES public.profiles (id) ON DELETE SET NULL,
  customer_name           text,
  customer_email          text,
  branch_id               text
                          CONSTRAINT tickets_branch_id_fkey REFERENCES public.branches (id) ON DELETE SET NULL,
  -- The only foreign key from tickets to products (the UI embeds product:products(*)).
  product_id              uuid
                          CONSTRAINT tickets_product_id_fkey REFERENCES public.products (id) ON DELETE SET NULL,
  product_family          varchar(255),
  product_tier            varchar(255),
  target_version          text,
  is_known_issue          boolean NOT NULL DEFAULT false,
  -- Deleting a project ticket also deletes its dev tasks.
  parent_ticket_id        uuid
                          CONSTRAINT tickets_parent_ticket_id_fkey REFERENCES public.tickets (id) ON DELETE CASCADE,
  milestone_id            uuid
                          CONSTRAINT tickets_milestone_id_fkey REFERENCES public.milestones (id) ON DELETE SET NULL,
  is_blocked              boolean NOT NULL DEFAULT false,
  blocked_reason          text,
  blocked_by_ticket_id    uuid
                          CONSTRAINT tickets_blocked_by_ticket_id_fkey REFERENCES public.tickets (id) ON DELETE SET NULL,
  customer_approved       boolean NOT NULL DEFAULT false,
  admin_approved          boolean NOT NULL DEFAULT false,
  archived_by_customer    boolean NOT NULL DEFAULT false,
  estimated_hours         numeric,
  billed_hours            numeric,
  target_start_date       timestamptz,
  target_test_date        timestamptz,
  target_completion_date  timestamptz,
  release_date            timestamptz,
  sla_response_deadline   timestamptz,
  sla_resolution_deadline timestamptz,
  first_responded_at      timestamptz,
  sla_response_breached   boolean NOT NULL DEFAULT false,
  sla_resolution_breached boolean NOT NULL DEFAULT false,
  attachment_url          text,    -- legacy single attachment path
  notes                   text[],  -- legacy
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  resolved_at             timestamptz  -- set by trigger when status becomes 'done'
);

-- 3.6 Ticket watchers (the only foreign key from ticket_watchers to tickets)
CREATE TABLE IF NOT EXISTS public.ticket_watchers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid NOT NULL
             CONSTRAINT ticket_watchers_ticket_id_fkey REFERENCES public.tickets (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL
             CONSTRAINT ticket_watchers_user_id_fkey REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_watchers_ticket_id_user_id_key UNIQUE (ticket_id, user_id)
);

-- 3.7 Activity log shown in the ticket feed (single foreign key to profiles)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid
             CONSTRAINT activity_logs_ticket_id_fkey REFERENCES public.tickets (id) ON DELETE CASCADE,
  actor_id   uuid
             CONSTRAINT activity_logs_actor_id_fkey REFERENCES public.profiles (id) ON DELETE SET NULL,
  action     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.8 Ticket comments (single foreign key to profiles; author is NULL once the
-- author's account is deleted)
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id        uuid NOT NULL
                   CONSTRAINT ticket_comments_ticket_id_fkey REFERENCES public.tickets (id) ON DELETE CASCADE,
  author_id        uuid
                   CONSTRAINT ticket_comments_author_id_fkey REFERENCES public.profiles (id) ON DELETE SET NULL,
  comment_text     text NOT NULL,
  is_internal_only boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 3.9 Ticket attachments (file metadata; the files live in the
-- "ticket_attachments" storage bucket at file_path)
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL
              CONSTRAINT ticket_attachments_ticket_id_fkey REFERENCES public.tickets (id) ON DELETE CASCADE,
  file_path   text NOT NULL,
  file_name   text NOT NULL,
  file_size   bigint,
  uploaded_by uuid
              CONSTRAINT ticket_attachments_uploaded_by_fkey REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3.10 Time entries: manual logs and live timers (single foreign key to profiles)
CREATE TABLE IF NOT EXISTS public.time_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid NOT NULL
                CONSTRAINT time_entries_ticket_id_fkey REFERENCES public.tickets (id) ON DELETE CASCADE,
  technician_id uuid
                CONSTRAINT time_entries_technician_id_fkey REFERENCES public.profiles (id) ON DELETE SET NULL,
  hours         numeric NOT NULL DEFAULT 0,
  description   text,
  started_at    timestamptz,
  is_running    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 3.11 In-app notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL
             CONSTRAINT notifications_user_id_fkey REFERENCES public.profiles (id) ON DELETE CASCADE,
  actor_id   uuid
             CONSTRAINT notifications_actor_id_fkey REFERENCES public.profiles (id) ON DELETE SET NULL,
  ticket_id  uuid
             CONSTRAINT notifications_ticket_id_fkey REFERENCES public.tickets (id) ON DELETE CASCADE,
  type       text NOT NULL
             CONSTRAINT notifications_type_check
             CHECK (type IN ('status_change', 'assignment', 'new_comment', 'mention', 'system')),
  title      text NOT NULL,
  message    text NOT NULL,
  is_read    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3.12 Audit log (written only by triggers and delete_user_officially)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid
              CONSTRAINT audit_logs_actor_id_fkey REFERENCES auth.users (id) ON DELETE SET NULL,
  target_id   uuid,            -- id of the changed row (no foreign key on purpose)
  entity_type text NOT NULL,   -- 'profile', 'ticket', 'user'
  action      text NOT NULL,   -- 'UPDATE_ROLE', 'ACTIVATE', 'DEACTIVATE', 'DELETE'
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3.13 SLA targets per priority (seeded below; the UI edits but never adds rows)
CREATE TABLE IF NOT EXISTS public.sla_policies (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  priority              text NOT NULL
                        CONSTRAINT sla_policies_priority_key UNIQUE
                        CONSTRAINT sla_policies_priority_check
                        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  response_time_hours   numeric NOT NULL DEFAULT 24,
  resolution_time_hours numeric NOT NULL DEFAULT 168,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- 3.14 Approval gates: status transitions that need an approval first
CREATE TABLE IF NOT EXISTS public.approval_gates (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_status                text NOT NULL,
  to_status                  text NOT NULL,
  requires_admin_approval    boolean NOT NULL DEFAULT false,
  requires_customer_approval boolean NOT NULL DEFAULT false,
  is_active                  boolean NOT NULL DEFAULT true,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_gates_from_status_to_status_key UNIQUE (from_status, to_status)
);

-- 3.15 Linked tickets. A trigger keeps the mirror row (A blocks B <-> B
-- blocked_by A) in sync. The UI matches the "no_self_relationship" name in errors.
CREATE TABLE IF NOT EXISTS public.ticket_relationships (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_ticket_id  uuid NOT NULL
                    CONSTRAINT ticket_relationships_source_ticket_id_fkey REFERENCES public.tickets (id) ON DELETE CASCADE,
  target_ticket_id  uuid NOT NULL
                    CONSTRAINT ticket_relationships_target_ticket_id_fkey REFERENCES public.tickets (id) ON DELETE CASCADE,
  relationship_type text NOT NULL
                    CONSTRAINT ticket_relationships_relationship_type_check
                    CHECK (relationship_type IN ('related_to', 'duplicate_of', 'duplicated_by', 'blocked_by', 'blocks')),
  created_by        uuid
                    CONSTRAINT ticket_relationships_created_by_fkey REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_relationships_source_target_type_key
    UNIQUE (source_ticket_id, target_ticket_id, relationship_type),
  CONSTRAINT no_self_relationship CHECK (source_ticket_id <> target_ticket_id)
);

-- 3.16 Releases (release_date is a plain date: the UI binds it to <input type="date">)
CREATE TABLE IF NOT EXISTS public.releases (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version      text NOT NULL,
  name         text,
  description  text,
  status       text NOT NULL DEFAULT 'planned'
               CONSTRAINT releases_status_check
               CHECK (status IN ('planned', 'in_progress', 'staged', 'released', 'rolled_back')),
  release_date date,
  product_id   uuid
               CONSTRAINT releases_product_id_fkey REFERENCES public.products (id) ON DELETE SET NULL,
  milestone_id uuid
               CONSTRAINT releases_milestone_id_fkey REFERENCES public.milestones (id) ON DELETE SET NULL,
  created_by   uuid
               CONSTRAINT releases_created_by_fkey REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 3.17 Tickets included in a release
CREATE TABLE IF NOT EXISTS public.release_tickets (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL
             CONSTRAINT release_tickets_release_id_fkey REFERENCES public.releases (id) ON DELETE CASCADE,
  ticket_id  uuid NOT NULL
             CONSTRAINT release_tickets_ticket_id_fkey REFERENCES public.tickets (id) ON DELETE CASCADE,
  added_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT release_tickets_release_id_ticket_id_key UNIQUE (release_id, ticket_id)
);

-- 3.18 Knowledge base articles
CREATE TABLE IF NOT EXISTS public.kb_articles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  content      text NOT NULL DEFAULT '',
  product_id   uuid
               CONSTRAINT kb_articles_product_id_fkey REFERENCES public.products (id) ON DELETE SET NULL,
  category     text NOT NULL DEFAULT 'general'
               CONSTRAINT kb_articles_category_check
               CHECK (category IN ('general', 'how_to', 'troubleshooting', 'faq', 'release_notes',
                                   'onboarding', 'api_reference', 'internal')),
  tags         text[] NOT NULL DEFAULT '{}',
  author_id    uuid
               CONSTRAINT kb_articles_author_id_fkey REFERENCES public.profiles (id) ON DELETE SET NULL,
  is_published boolean NOT NULL DEFAULT false,
  view_count   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- Full-text search vector (title weighted above content)
  fts          tsvector GENERATED ALWAYS AS (
                 setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                 setweight(to_tsvector('english', coalesce(content, '')), 'B')
               ) STORED
);


-- =============================================================================
-- 4. INDEXES
-- =============================================================================

-- Only one running timer per technician. The UI matches this index name in the
-- error it gets back when a second timer is started.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_running_timer_per_tech
  ON public.time_entries (technician_id)
  WHERE is_running = true;

CREATE INDEX IF NOT EXISTS idx_profiles_branch_id           ON public.profiles (branch_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower         ON public.profiles (lower(email));

CREATE INDEX IF NOT EXISTS idx_tickets_created_at           ON public.tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by           ON public.tickets (created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to          ON public.tickets (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_branch_id            ON public.tickets (branch_id);
CREATE INDEX IF NOT EXISTS idx_tickets_product_id           ON public.tickets (product_id);
CREATE INDEX IF NOT EXISTS idx_tickets_parent_ticket_id     ON public.tickets (parent_ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_blocked_by_ticket_id ON public.tickets (blocked_by_ticket_id);
CREATE INDEX IF NOT EXISTS idx_tickets_milestone            ON public.tickets (milestone_id);

CREATE INDEX IF NOT EXISTS idx_ticket_watchers_user_id      ON public.ticket_watchers (user_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_ticket_id      ON public.activity_logs (ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_id       ON public.activity_logs (actor_id);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id    ON public.ticket_comments (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_author_id    ON public.ticket_comments (author_id);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id   ON public.ticket_attachments (ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_by ON public.ticket_attachments (uploaded_by);
-- Used by the storage read policy (section 8)
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_file_path   ON public.ticket_attachments (file_path);

CREATE INDEX IF NOT EXISTS idx_time_entries_ticket_id       ON public.time_entries (ticket_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_technician_id   ON public.time_entries (technician_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_created_at      ON public.time_entries (created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id        ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id       ON public.notifications (actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_ticket_id      ON public.notifications (ticket_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at        ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id          ON public.audit_logs (actor_id);

CREATE INDEX IF NOT EXISTS idx_ticket_rel_source            ON public.ticket_relationships (source_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_rel_target            ON public.ticket_relationships (target_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_rel_created_by        ON public.ticket_relationships (created_by);

CREATE INDEX IF NOT EXISTS idx_milestones_product_id        ON public.milestones (product_id);
CREATE INDEX IF NOT EXISTS idx_milestones_created_by        ON public.milestones (created_by);

CREATE INDEX IF NOT EXISTS idx_releases_product_id          ON public.releases (product_id);
CREATE INDEX IF NOT EXISTS idx_releases_milestone_id        ON public.releases (milestone_id);
CREATE INDEX IF NOT EXISTS idx_releases_created_by          ON public.releases (created_by);

CREATE INDEX IF NOT EXISTS idx_release_tickets_ticket       ON public.release_tickets (ticket_id);

CREATE INDEX IF NOT EXISTS idx_kb_articles_fts              ON public.kb_articles USING gin (fts);
CREATE INDEX IF NOT EXISTS idx_kb_articles_category         ON public.kb_articles (category);
CREATE INDEX IF NOT EXISTS idx_kb_articles_product          ON public.kb_articles (product_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_author_id        ON public.kb_articles (author_id);


-- =============================================================================
-- 5. FUNCTIONS
-- =============================================================================
-- Every function pins search_path to '' and schema-qualifies its references,
-- so a caller cannot redirect it to look-alike objects.

-- 5.1 Role helpers used by the RLS policies ----------------------------------
-- SECURITY DEFINER lets them read public.profiles without going through the
-- profiles policies (no recursive RLS). Both return NULL for signed-out users
-- and for deactivated accounts, so every role-based policy denies them.

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid())
    AND p.is_active
$$;

CREATE OR REPLACE FUNCTION public.get_my_branch_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.branch_id
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid())
    AND p.is_active
$$;

-- The lower-cased email on the caller's profile. Customer ticket access keys
-- on this rather than on the email in the login token: only an admin can
-- change a profile's email, but users can change their own login email.
CREATE OR REPLACE FUNCTION public.get_my_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT lower(p.email)
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid())
    AND p.is_active
$$;

-- 5.2 Generic helpers --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 5.3 Accounts ---------------------------------------------------------------

-- Creates the profile row for every new auth user. The least-privileged role
-- and is_active = false mean an account that was not created through the Admin
-- panel (e.g. a public sign-up) cannot do anything until an admin enables it.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, is_active)
  VALUES (
    NEW.id,
    lower(coalesce(NEW.email, '')),
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    'customer',
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Blocks privilege escalation through the API. Only an admin may change
-- another user's (or their own) role, active flag, forced-reset flag, branch,
-- email or id. current_user is 'authenticated' / 'anon' only for direct API
-- requests; trusted paths run as another role and pass through: the
-- SECURITY DEFINER RPCs below (function owner), the admin-actions edge
-- function ('service_role') and the SQL editor ('postgres').
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon')
     AND (SELECT public.get_my_role()) IS DISTINCT FROM 'admin'
     AND (   NEW.id                   IS DISTINCT FROM OLD.id
          OR NEW.email                IS DISTINCT FROM OLD.email
          OR NEW.role                 IS DISTINCT FROM OLD.role
          OR NEW.is_active            IS DISTINCT FROM OLD.is_active
          OR NEW.force_password_reset IS DISTINCT FROM OLD.force_password_reset
          OR NEW.branch_id            IS DISTINCT FROM OLD.branch_id) THEN
    RAISE EXCEPTION 'Only an admin can change a profile''s role, active status, password reset flag, branch or email.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- The first-login reset flag is cleared only by the admin-actions edge function
-- (update-password), after the password has actually changed. A client-callable
-- RPC would let users skip the reset, so remove it if an older install has one.
DROP FUNCTION IF EXISTS public.clear_force_password_reset();

-- RPC behind Admin -> Users -> Permanently Delete. Admin only; cannot delete
-- yourself. The user's tickets, comments, time entries and other history stay
-- (their user columns become NULL); their notifications and watch list go.
CREATE OR REPLACE FUNCTION public.delete_user_officially(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_snapshot jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only active admins can delete users.'
      USING ERRCODE = '42501';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No user was given to delete.';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Self-deletion is not allowed.';
  END IF;

  SELECT jsonb_build_object('id', p.id, 'email', p.email, 'full_name', p.full_name, 'role', p.role)
  INTO v_snapshot
  FROM public.profiles AS p
  WHERE p.id = target_user_id;

  -- Unassign their open work (bumps updated_at so boards refresh) and discard
  -- a timer that is still running.
  UPDATE public.tickets SET assigned_to = NULL WHERE assigned_to = target_user_id;
  DELETE FROM public.time_entries WHERE technician_id = target_user_id AND is_running;

  -- Cascades to public.profiles; the foreign keys above clean up the rest.
  DELETE FROM auth.users WHERE id = target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % was not found.', target_user_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, target_id, entity_type, action, old_data)
  VALUES (auth.uid(), target_user_id, 'user', 'DELETE',
          coalesce(v_snapshot, jsonb_build_object('id', target_user_id)));
END;
$$;

-- 5.4 Audit log ---------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action text;
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    v_action := 'UPDATE_ROLE';
  ELSIF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    v_action := CASE WHEN NEW.is_active THEN 'ACTIVATE' ELSE 'DEACTIVATE' END;
  END IF;

  -- Only role and activation changes are logged
  IF v_action IS NOT NULL THEN
    INSERT INTO public.audit_logs (actor_id, target_id, entity_type, action, old_data, new_data)
    VALUES (auth.uid(), NEW.id, 'profile', v_action, to_jsonb(OLD), to_jsonb(NEW));
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_ticket_deletions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_logs (actor_id, target_id, entity_type, action, old_data)
  VALUES (auth.uid(), OLD.id, 'ticket', 'DELETE', to_jsonb(OLD));

  RETURN OLD;
END;
$$;

-- 5.5 Tickets -------------------------------------------------------------------

-- FLD-0001, FLD-0002, ... (zero-padded so the IDs sort as text). A number sent
-- through the API is ignored, so nobody can claim an upcoming number; trusted
-- paths (e.g. an import in the SQL editor) may still set their own.
CREATE OR REPLACE FUNCTION public.set_readable_ticket_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.readable_id IS NULL OR current_user IN ('authenticated', 'anon') THEN
    NEW.readable_id := 'FLD-' || lpad(nextval('public.ticket_seq')::text, 4, '0');
  END IF;

  RETURN NEW;
END;
$$;

-- Server-side backstop for two rules the app already follows: only an admin
-- may grant admin approval (anyone who can edit the ticket may revoke it), and
-- a ticket's FLD number never changes. Trusted paths pass through, exactly as
-- in guard_profile_privileged_columns.
CREATE OR REPLACE FUNCTION public.guard_ticket_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_granted boolean;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      v_granted := NEW.admin_approved;
    ELSE
      v_granted := NEW.admin_approved AND NOT OLD.admin_approved;

      IF NEW.readable_id IS DISTINCT FROM OLD.readable_id THEN
        RAISE EXCEPTION 'A ticket''s number cannot be changed.'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    IF v_granted AND (SELECT public.get_my_role()) IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Only an admin can grant admin approval.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Customer approval of a ticket that is Awaiting Customer Approval promotes it
-- to Ready for Dev. At any other status (e.g. the Approved -> Released gate)
-- the approval is only recorded.
CREATE OR REPLACE FUNCTION public.handle_customer_approval_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.customer_approved AND NOT OLD.customer_approved
     AND OLD.status = 'awaiting_customer_approval' THEN
    NEW.status := 'ready_for_dev';
  END IF;

  RETURN NEW;
END;
$$;

-- resolved_at is stamped when a ticket reaches 'done' and cleared if it moves
-- back out (the Executive dashboard and Reports read it).
CREATE OR REPLACE FUNCTION public.set_ticket_resolved_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'done' AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    END IF;
  ELSIF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    NEW.resolved_at := now();
  ELSIF NEW.status <> 'done' THEN
    NEW.resolved_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- SLA deadlines from the active policy for the ticket's priority.
CREATE OR REPLACE FUNCTION public.compute_sla_deadlines()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_policy record;
BEGIN
  SELECT sp.response_time_hours, sp.resolution_time_hours
  INTO v_policy
  FROM public.sla_policies AS sp
  WHERE sp.priority = NEW.priority::text AND sp.is_active
  LIMIT 1;

  IF FOUND THEN
    NEW.sla_response_deadline   := coalesce(NEW.created_at, now()) + (v_policy.response_time_hours || ' hours')::interval;
    NEW.sla_resolution_deadline := coalesce(NEW.created_at, now()) + (v_policy.resolution_time_hours || ' hours')::interval;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_sla_on_priority_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_policy record;
BEGIN
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    SELECT sp.response_time_hours, sp.resolution_time_hours
    INTO v_policy
    FROM public.sla_policies AS sp
    WHERE sp.priority = NEW.priority::text AND sp.is_active
    LIMIT 1;

    IF FOUND THEN
      NEW.sla_response_deadline   := NEW.created_at + (v_policy.response_time_hours || ' hours')::interval;
      NEW.sla_resolution_deadline := NEW.created_at + (v_policy.resolution_time_hours || ' hours')::interval;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- First response = the first time a ticket leaves 'pending'. Breach flags are
-- set at that moment and when the ticket reaches 'done'.
CREATE OR REPLACE FUNCTION public.track_first_response()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status <> 'pending' AND NEW.first_responded_at IS NULL THEN
    NEW.first_responded_at := now();
    IF NEW.sla_response_deadline IS NOT NULL AND now() > NEW.sla_response_deadline THEN
      NEW.sla_response_breached := true;
    END IF;
  END IF;

  IF NEW.status = 'done' AND OLD.status <> 'done' THEN
    IF NEW.sla_resolution_deadline IS NOT NULL AND now() > NEW.sla_resolution_deadline THEN
      NEW.sla_resolution_breached := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 5.6 Notifications -----------------------------------------------------------
-- The "customer" of a ticket is the active profile whose email matches
-- tickets.customer_email. The person who made the change is never notified,
-- and neither are deactivated accounts.

CREATE OR REPLACE FUNCTION public.notify_ticket_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id    uuid := auth.uid();
  v_actor_name  text;
  v_customer_id uuid;
  v_status      text;
  v_message     text;
  v_watcher     record;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT p.id INTO v_customer_id
    FROM public.profiles AS p
    WHERE NEW.customer_email IS NOT NULL
      AND lower(p.email) = lower(NEW.customer_email)
      AND p.is_active
    LIMIT 1;

    SELECT p.full_name INTO v_actor_name FROM public.profiles AS p WHERE p.id = v_actor_id;

    -- 'dev_in_progress' -> 'Dev in progress'
    v_status  := replace(NEW.status::text, '_', ' ');
    v_status  := upper(substring(v_status FROM 1 FOR 1)) || substring(v_status FROM 2);
    v_message := coalesce(v_actor_name, 'A team member') || ' moved ticket "' || NEW.title || '" to ' || v_status || '.';

    IF v_customer_id IS NOT NULL AND v_customer_id IS DISTINCT FROM v_actor_id THEN
      INSERT INTO public.notifications (user_id, actor_id, ticket_id, type, title, message)
      VALUES (v_customer_id, v_actor_id, NEW.id, 'status_change', 'Ticket Status Updated', v_message);
    END IF;

    FOR v_watcher IN
      SELECT w.user_id
      FROM public.ticket_watchers AS w
      JOIN public.profiles AS p ON p.id = w.user_id
      WHERE w.ticket_id = NEW.id
        AND p.is_active
    LOOP
      IF v_watcher.user_id IS DISTINCT FROM v_actor_id
         AND v_watcher.user_id IS DISTINCT FROM v_customer_id THEN
        INSERT INTO public.notifications (user_id, actor_id, ticket_id, type, title, message)
        VALUES (v_watcher.user_id, v_actor_id, NEW.id, 'status_change', 'Ticket Status Updated', v_message);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_ticket_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id   uuid := auth.uid();
  v_actor_name text;
  v_watcher    record;
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    SELECT p.full_name INTO v_actor_name FROM public.profiles AS p WHERE p.id = v_actor_id;

    -- No notification when you assign a ticket to yourself
    IF NEW.assigned_to IS DISTINCT FROM v_actor_id THEN
      INSERT INTO public.notifications (user_id, actor_id, ticket_id, type, title, message)
      VALUES (
        NEW.assigned_to, v_actor_id, NEW.id, 'assignment', 'You have been assigned a ticket',
        coalesce(v_actor_name, 'A team member') || ' assigned you to ticket "' || substring(NEW.title, 1, 30) || '...".'
      );
    END IF;

    FOR v_watcher IN
      SELECT w.user_id
      FROM public.ticket_watchers AS w
      JOIN public.profiles AS p ON p.id = w.user_id
      WHERE w.ticket_id = NEW.id
        AND p.is_active
    LOOP
      IF v_watcher.user_id IS DISTINCT FROM v_actor_id
         AND v_watcher.user_id IS DISTINCT FROM NEW.assigned_to THEN
        INSERT INTO public.notifications (user_id, actor_id, ticket_id, type, title, message)
        VALUES (
          v_watcher.user_id, v_actor_id, NEW.id, 'assignment', 'Ticket Reassigned',
          coalesce(v_actor_name, 'A team member') || ' reassigned ticket "' || substring(NEW.title, 1, 30) || '...".'
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ticket_title   text;
  v_customer_email text;
  v_assignee_id    uuid;
  v_customer_id    uuid;
  v_actor_name     text;
  v_actor_role     text;
  v_watcher        record;
BEGIN
  SELECT t.title, t.customer_email, t.assigned_to
  INTO v_ticket_title, v_customer_email, v_assignee_id
  FROM public.tickets AS t
  WHERE t.id = NEW.ticket_id;

  SELECT p.id INTO v_customer_id
  FROM public.profiles AS p
  WHERE v_customer_email IS NOT NULL
    AND lower(p.email) = lower(v_customer_email)
    AND p.is_active
  LIMIT 1;

  SELECT p.full_name, p.role::text INTO v_actor_name, v_actor_role
  FROM public.profiles AS p
  WHERE p.id = NEW.author_id;

  -- 1. Public reply from staff: notify the customer
  IF NOT NEW.is_internal_only
     AND v_actor_role IN ('admin', 'developer', 'support_desk', 'branch_manager')
     AND v_customer_id IS NOT NULL
     AND v_customer_id IS DISTINCT FROM NEW.author_id THEN
    INSERT INTO public.notifications (user_id, actor_id, ticket_id, type, title, message)
    VALUES (
      v_customer_id, NEW.author_id, NEW.ticket_id, 'new_comment', 'New Reply on Ticket',
      coalesce(v_actor_name, 'FlowDesk Support') || ' replied to "' || substring(v_ticket_title, 1, 30) || '...".'
    );
  END IF;

  -- 2. Comment from the customer: notify the assignee
  IF v_actor_role = 'customer' AND v_assignee_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, actor_id, ticket_id, type, title, message)
    VALUES (
      v_assignee_id, NEW.author_id, NEW.ticket_id, 'new_comment', 'Customer Replied',
      coalesce(v_actor_name, 'The customer') || ' added a comment to your assigned ticket: "' || substring(v_ticket_title, 1, 30) || '...".'
    );
  END IF;

  -- 3. Watchers (skipping the author, the customer, and an assignee already notified above)
  FOR v_watcher IN
    SELECT w.user_id
    FROM public.ticket_watchers AS w
    JOIN public.profiles AS p ON p.id = w.user_id
    WHERE w.ticket_id = NEW.ticket_id
      AND p.is_active
  LOOP
    IF v_watcher.user_id IS DISTINCT FROM NEW.author_id
       AND v_watcher.user_id IS DISTINCT FROM v_customer_id
       AND (v_watcher.user_id IS DISTINCT FROM v_assignee_id OR v_actor_role IS DISTINCT FROM 'customer') THEN
      INSERT INTO public.notifications (user_id, actor_id, ticket_id, type, title, message)
      VALUES (
        v_watcher.user_id, NEW.author_id, NEW.ticket_id, 'new_comment', 'New Comment',
        coalesce(v_actor_name, 'A team member') || ' commented on ticket: "' || substring(v_ticket_title, 1, 30) || '...".'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Keeps each user's notifications to the last 30 days (no pg_cron needed).
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE user_id = NEW.user_id
    AND created_at < now() - interval '30 days';

  RETURN NEW;
END;
$$;

-- 5.7 Ticket relationships --------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_reciprocal_relationship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reciprocal text;
BEGIN
  v_reciprocal := CASE NEW.relationship_type
    WHEN 'blocks'        THEN 'blocked_by'
    WHEN 'blocked_by'    THEN 'blocks'
    WHEN 'duplicate_of'  THEN 'duplicated_by'
    WHEN 'duplicated_by' THEN 'duplicate_of'
    WHEN 'related_to'    THEN 'related_to'
  END;

  IF v_reciprocal IS NOT NULL THEN
    -- The mirror row's own trigger finds the original already present and stops.
    INSERT INTO public.ticket_relationships (source_ticket_id, target_ticket_id, relationship_type, created_by)
    VALUES (NEW.target_ticket_id, NEW.source_ticket_id, v_reciprocal, NEW.created_by)
    ON CONFLICT (source_ticket_id, target_ticket_id, relationship_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_reciprocal_relationship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reciprocal text;
BEGIN
  v_reciprocal := CASE OLD.relationship_type
    WHEN 'blocks'        THEN 'blocked_by'
    WHEN 'blocked_by'    THEN 'blocks'
    WHEN 'duplicate_of'  THEN 'duplicated_by'
    WHEN 'duplicated_by' THEN 'duplicate_of'
    WHEN 'related_to'    THEN 'related_to'
  END;

  IF v_reciprocal IS NOT NULL THEN
    DELETE FROM public.ticket_relationships
    WHERE source_ticket_id = OLD.target_ticket_id
      AND target_ticket_id = OLD.source_ticket_id
      AND relationship_type = v_reciprocal;
  END IF;

  RETURN OLD;
END;
$$;

-- 5.8 Knowledge base ----------------------------------------------------------

-- RPC behind the Knowledge Base view counter. Everyone who can read an article
-- counts a view, but only staff may edit articles (RLS), so the counter cannot
-- go through the UPDATE policy. Changes nothing but view_count and returns the
-- new count, or NULL if the caller cannot see the article.
CREATE OR REPLACE FUNCTION public.increment_kb_view_count(article_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role  public.user_role := public.get_my_role();
  v_count integer;
BEGIN
  UPDATE public.kb_articles AS a
     SET view_count = a.view_count + 1
   WHERE a.id = increment_kb_view_count.article_id
     AND v_role IS NOT NULL
     AND (a.is_published OR v_role IN ('admin', 'developer', 'support_desk'))
  RETURNING a.view_count INTO v_count;

  RETURN v_count;
END;
$$;


-- =============================================================================
-- 6. TRIGGERS
-- =============================================================================
-- Triggers of the same timing fire in alphabetical order of their names.

-- 6.1 auth.users -> profiles
-- Created only when missing: the table belongs to Supabase Auth, so this file
-- never drops a trigger on it. handle_new_user itself is replaced above.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
      AND tgrelid = 'auth.users'::regclass
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END
$$;

-- 6.2 profiles
DROP TRIGGER IF EXISTS guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();

DROP TRIGGER IF EXISTS set_timestamp_profiles ON public.profiles;
CREATE TRIGGER set_timestamp_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS trigger_log_profile_changes ON public.profiles;
CREATE TRIGGER trigger_log_profile_changes
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_profile_changes();

-- 6.3 tickets
DROP TRIGGER IF EXISTS guard_ticket_privileged_columns ON public.tickets;
CREATE TRIGGER guard_ticket_privileged_columns
  BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.guard_ticket_privileged_columns();

DROP TRIGGER IF EXISTS trigger_set_ticket_id ON public.tickets;
CREATE TRIGGER trigger_set_ticket_id
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_readable_ticket_id();

DROP TRIGGER IF EXISTS trigger_compute_sla_on_insert ON public.tickets;
CREATE TRIGGER trigger_compute_sla_on_insert
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.compute_sla_deadlines();

DROP TRIGGER IF EXISTS set_timestamp_tickets ON public.tickets;
CREATE TRIGGER set_timestamp_tickets
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS ticket_auto_ready_for_dev ON public.tickets;
CREATE TRIGGER ticket_auto_ready_for_dev
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_customer_approval_trigger();

DROP TRIGGER IF EXISTS trigger_recompute_sla_on_priority ON public.tickets;
CREATE TRIGGER trigger_recompute_sla_on_priority
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.recompute_sla_on_priority_change();

-- Runs after ticket_auto_ready_for_dev, so it sees the final status.
DROP TRIGGER IF EXISTS trigger_set_resolved_at ON public.tickets;
CREATE TRIGGER trigger_set_resolved_at
  BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_ticket_resolved_at();

DROP TRIGGER IF EXISTS trigger_track_first_response ON public.tickets;
CREATE TRIGGER trigger_track_first_response
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.track_first_response();

-- A WHEN condition rather than "UPDATE OF status": a column list only matches
-- columns named in the UPDATE statement, so it would miss the move to Ready
-- for Dev that ticket_auto_ready_for_dev makes when a customer approves.
DROP TRIGGER IF EXISTS on_ticket_status_change ON public.tickets;
CREATE TRIGGER on_ticket_status_change
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_ticket_status_change();

DROP TRIGGER IF EXISTS on_ticket_assignment ON public.tickets;
CREATE TRIGGER on_ticket_assignment
  AFTER UPDATE OF assigned_to ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_assignment();

DROP TRIGGER IF EXISTS trigger_log_ticket_deletions ON public.tickets;
CREATE TRIGGER trigger_log_ticket_deletions
  AFTER DELETE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.log_ticket_deletions();

-- 6.4 ticket_comments and notifications
DROP TRIGGER IF EXISTS on_new_comment ON public.ticket_comments;
CREATE TRIGGER on_new_comment
  AFTER INSERT ON public.ticket_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_comment();

DROP TRIGGER IF EXISTS trigger_cleanup_old_notifications ON public.notifications;
CREATE TRIGGER trigger_cleanup_old_notifications
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_old_notifications();

-- 6.5 ticket_relationships (the table has no updated_at column, so it has no
-- timestamp trigger; an earlier version attached one by mistake)
DROP TRIGGER IF EXISTS set_timestamp_ticket_relationships ON public.ticket_relationships;

DROP TRIGGER IF EXISTS trigger_reciprocal_relationship ON public.ticket_relationships;
CREATE TRIGGER trigger_reciprocal_relationship
  AFTER INSERT ON public.ticket_relationships
  FOR EACH ROW EXECUTE FUNCTION public.create_reciprocal_relationship();

DROP TRIGGER IF EXISTS trigger_delete_reciprocal_relationship ON public.ticket_relationships;
CREATE TRIGGER trigger_delete_reciprocal_relationship
  AFTER DELETE ON public.ticket_relationships
  FOR EACH ROW EXECUTE FUNCTION public.delete_reciprocal_relationship();

-- 6.6 updated_at on the remaining tables
DROP TRIGGER IF EXISTS set_timestamp_products ON public.products;
CREATE TRIGGER set_timestamp_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_milestones ON public.milestones;
CREATE TRIGGER set_timestamp_milestones
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_time_entries ON public.time_entries;
CREATE TRIGGER set_timestamp_time_entries
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_sla_policies ON public.sla_policies;
CREATE TRIGGER set_timestamp_sla_policies
  BEFORE UPDATE ON public.sla_policies
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_approval_gates ON public.approval_gates;
CREATE TRIGGER set_timestamp_approval_gates
  BEFORE UPDATE ON public.approval_gates
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

DROP TRIGGER IF EXISTS set_timestamp_releases ON public.releases;
CREATE TRIGGER set_timestamp_releases
  BEFORE UPDATE ON public.releases
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- Counting a view (increment_kb_view_count) is not an edit, so it leaves
-- updated_at (shown as "Updated ..." and used to sort the list) alone.
DROP TRIGGER IF EXISTS set_timestamp_kb_articles ON public.kb_articles;
CREATE TRIGGER set_timestamp_kb_articles
  BEFORE UPDATE ON public.kb_articles
  FOR EACH ROW
  WHEN (OLD.view_count IS NOT DISTINCT FROM NEW.view_count)
  EXECUTE FUNCTION public.trigger_set_timestamp();


-- =============================================================================
-- 7. PRIVILEGES AND ROW LEVEL SECURITY
-- =============================================================================
-- Signed-in users reach the tables through the "authenticated" role and RLS
-- decides which rows they see. The anonymous role gets nothing: FlowDesk has
-- no public pages. Grants are explicit so the schema also works on projects
-- that do not expose new tables to the Data API automatically.
--
-- In the policies, a "member" is a signed-in user with an active profile,
-- i.e. public.get_my_role() IS NOT NULL. Staff = admin, developer, support_desk.
-- The team = staff plus branch_manager. Customers are members, but reach only
-- their own tickets and profile and the shared settings; everything else that
-- is not tied to a ticket they can see is team-only.

-- 7.1 Privileges
GRANT USAGE ON SCHEMA public TO authenticated, service_role;

REVOKE ALL ON TABLE
  public.profiles, public.branches, public.products, public.milestones, public.tickets,
  public.ticket_watchers, public.activity_logs, public.ticket_comments, public.ticket_attachments,
  public.time_entries, public.notifications, public.audit_logs, public.sla_policies,
  public.approval_gates, public.ticket_relationships, public.releases, public.release_tickets,
  public.kb_articles
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.profiles, public.branches, public.products, public.milestones, public.tickets,
  public.ticket_watchers, public.activity_logs, public.ticket_comments, public.ticket_attachments,
  public.time_entries, public.notifications, public.audit_logs, public.sla_policies,
  public.approval_gates, public.ticket_relationships, public.releases, public.release_tickets,
  public.kb_articles
TO authenticated;

GRANT ALL ON TABLE
  public.profiles, public.branches, public.products, public.milestones, public.tickets,
  public.ticket_watchers, public.activity_logs, public.ticket_comments, public.ticket_attachments,
  public.time_entries, public.notifications, public.audit_logs, public.sla_policies,
  public.approval_gates, public.ticket_relationships, public.releases, public.release_tickets,
  public.kb_articles
TO service_role;

REVOKE ALL ON SEQUENCE public.ticket_seq FROM anon;
GRANT USAGE, SELECT ON SEQUENCE public.ticket_seq TO authenticated, service_role;

-- RPCs and policy helpers: signed-in users only.
REVOKE EXECUTE ON FUNCTION
  public.get_my_role(), public.get_my_branch_id(), public.get_my_email(),
  public.delete_user_officially(uuid), public.increment_kb_view_count(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION
  public.get_my_role(), public.get_my_branch_id(), public.get_my_email(),
  public.delete_user_officially(uuid), public.increment_kb_view_count(uuid)
TO authenticated, service_role;

-- 7.2 Enable RLS
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_watchers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_attachments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_policies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_gates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.releases             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_tickets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kb_articles          ENABLE ROW LEVEL SECURITY;

-- 7.3 Start from a clean slate: the policies below are the complete set.
DO $$
DECLARE
  v_policy record;
BEGIN
  FOR v_policy IN
    SELECT pol.policyname, pol.tablename
    FROM pg_policies AS pol
    WHERE pol.schemaname = 'public'
      AND pol.tablename IN (
        'profiles', 'branches', 'products', 'milestones', 'tickets', 'ticket_watchers',
        'activity_logs', 'ticket_comments', 'ticket_attachments', 'time_entries',
        'notifications', 'audit_logs', 'sla_policies', 'approval_gates',
        'ticket_relationships', 'releases', 'release_tickets', 'kb_articles'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_policy.tablename);
  END LOOP;
END
$$;

-- 7.4 profiles
-- The team sees everyone (assignee pickers, @mentions); customers see only
-- themselves. A deactivated user can still read their own row, which is how
-- the app knows to show "Account Deactivated". Writes are limited to your own
-- row unless you are an admin, and the guard_profile_privileged_columns
-- trigger stops non-admins from changing role, is_active,
-- force_password_reset, branch_id or email.
-- Profiles are created by handle_new_user and removed by delete_user_officially.
DROP POLICY IF EXISTS "Team members can view profiles" ON public.profiles;
CREATE POLICY "Team members can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk', 'branch_manager')
  );

DROP POLICY IF EXISTS "Users can update their own profile; admins can update any" ON public.profiles;
CREATE POLICY "Users can update their own profile; admins can update any"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT public.get_my_role()) = 'admin')
  WITH CHECK (id = (SELECT auth.uid()) OR (SELECT public.get_my_role()) = 'admin');

-- 7.5 branches
DROP POLICY IF EXISTS "Members can view branches" ON public.branches;
CREATE POLICY "Members can view branches"
  ON public.branches FOR SELECT TO authenticated
  USING ((SELECT public.get_my_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can create branches" ON public.branches;
CREATE POLICY "Admins can create branches"
  ON public.branches FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');

DROP POLICY IF EXISTS "Admins can update branches" ON public.branches;
CREATE POLICY "Admins can update branches"
  ON public.branches FOR UPDATE TO authenticated
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');

DROP POLICY IF EXISTS "Admins can delete branches" ON public.branches;
CREATE POLICY "Admins can delete branches"
  ON public.branches FOR DELETE TO authenticated
  USING ((SELECT public.get_my_role()) = 'admin');

-- 7.6 products (archived instead of deleted, so there is no DELETE policy)
DROP POLICY IF EXISTS "Members can view products" ON public.products;
CREATE POLICY "Members can view products"
  ON public.products FOR SELECT TO authenticated
  USING ((SELECT public.get_my_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can create products" ON public.products;
CREATE POLICY "Admins can create products"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');

DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products"
  ON public.products FOR UPDATE TO authenticated
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');

-- 7.7 tickets
DROP POLICY IF EXISTS "Staff and branch managers can view all tickets" ON public.tickets;
CREATE POLICY "Staff and branch managers can view all tickets"
  ON public.tickets FOR SELECT TO authenticated
  USING ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk', 'branch_manager'));

DROP POLICY IF EXISTS "Customers can view their own tickets" ON public.tickets;
CREATE POLICY "Customers can view their own tickets"
  ON public.tickets FOR SELECT TO authenticated
  USING (
    (SELECT public.get_my_role()) = 'customer'
    AND lower(customer_email) = (SELECT public.get_my_email())
  );

DROP POLICY IF EXISTS "Staff and branch managers can create tickets" ON public.tickets;
CREATE POLICY "Staff and branch managers can create tickets"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk', 'branch_manager')
    AND (created_by = (SELECT auth.uid()) OR (SELECT public.get_my_role()) = 'admin')
  );

DROP POLICY IF EXISTS "Staff can update tickets" ON public.tickets;
CREATE POLICY "Staff can update tickets"
  ON public.tickets FOR UPDATE TO authenticated
  USING ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk'));

DROP POLICY IF EXISTS "Branch managers can update their branch's tickets" ON public.tickets;
CREATE POLICY "Branch managers can update their branch's tickets"
  ON public.tickets FOR UPDATE TO authenticated
  USING (
    (SELECT public.get_my_role()) = 'branch_manager'
    AND branch_id = (SELECT public.get_my_branch_id())
  )
  WITH CHECK (
    (SELECT public.get_my_role()) = 'branch_manager'
    AND branch_id = (SELECT public.get_my_branch_id())
  );

DROP POLICY IF EXISTS "Staff can delete tickets" ON public.tickets;
CREATE POLICY "Staff can delete tickets"
  ON public.tickets FOR DELETE TO authenticated
  USING ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk'));

-- 7.8 ticket_watchers (anyone on the team can add or remove watchers, on
-- tickets they can see)
DROP POLICY IF EXISTS "Team members can view watchers" ON public.ticket_watchers;
CREATE POLICY "Team members can view watchers"
  ON public.ticket_watchers FOR SELECT TO authenticated
  USING ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk', 'branch_manager'));

DROP POLICY IF EXISTS "Team members can add watchers to tickets they can see" ON public.ticket_watchers;
CREATE POLICY "Team members can add watchers to tickets they can see"
  ON public.ticket_watchers FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk', 'branch_manager')
    AND EXISTS (SELECT 1 FROM public.tickets AS t WHERE t.id = ticket_watchers.ticket_id)
  );

DROP POLICY IF EXISTS "Team members can remove watchers" ON public.ticket_watchers;
CREATE POLICY "Team members can remove watchers"
  ON public.ticket_watchers FOR DELETE TO authenticated
  USING ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk', 'branch_manager'));

-- 7.9 activity_logs
-- "Tickets they can see" is decided by the tickets policies above, because the
-- sub-select on public.tickets runs under the caller's own RLS.
DROP POLICY IF EXISTS "Members can view activity on tickets they can see" ON public.activity_logs;
CREATE POLICY "Members can view activity on tickets they can see"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (
    (SELECT public.get_my_role()) IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.tickets AS t WHERE t.id = activity_logs.ticket_id)
  );

DROP POLICY IF EXISTS "Team members can log activity as themselves" ON public.activity_logs;
CREATE POLICY "Team members can log activity as themselves"
  ON public.activity_logs FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = (SELECT auth.uid())
    AND (SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk', 'branch_manager')
  );

-- 7.10 ticket_comments
-- Internal notes are staff-only, for writing as well as reading. Comments are
-- deleted through the admin-actions edge function (author or admin), so there
-- is no DELETE policy.
DROP POLICY IF EXISTS "Staff can view all comments" ON public.ticket_comments;
CREATE POLICY "Staff can view all comments"
  ON public.ticket_comments FOR SELECT TO authenticated
  USING ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk'));

DROP POLICY IF EXISTS "Members can view public comments on tickets they can see" ON public.ticket_comments;
CREATE POLICY "Members can view public comments on tickets they can see"
  ON public.ticket_comments FOR SELECT TO authenticated
  USING (
    NOT is_internal_only
    AND (SELECT public.get_my_role()) IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.tickets AS t WHERE t.id = ticket_comments.ticket_id)
  );

DROP POLICY IF EXISTS "Members can comment as themselves on tickets they can see" ON public.ticket_comments;
CREATE POLICY "Members can comment as themselves on tickets they can see"
  ON public.ticket_comments FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND (SELECT public.get_my_role()) IS NOT NULL
    AND (NOT is_internal_only OR (SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk'))
    AND EXISTS (SELECT 1 FROM public.tickets AS t WHERE t.id = ticket_comments.ticket_id)
  );

-- 7.11 ticket_attachments
-- Seeing a row also grants read access to its file (see section 8), so a row
-- may only point at a file in your own <user id>/ folder unless you are an
-- admin.
DROP POLICY IF EXISTS "Members can view attachments on tickets they can see" ON public.ticket_attachments;
CREATE POLICY "Members can view attachments on tickets they can see"
  ON public.ticket_attachments FOR SELECT TO authenticated
  USING (
    (SELECT public.get_my_role()) IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.tickets AS t WHERE t.id = ticket_attachments.ticket_id)
  );

DROP POLICY IF EXISTS "Members can attach files to tickets they can see" ON public.ticket_attachments;
CREATE POLICY "Members can attach files to tickets they can see"
  ON public.ticket_attachments FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.get_my_role()) IS NOT NULL
    AND (uploaded_by = (SELECT auth.uid()) OR (SELECT public.get_my_role()) = 'admin')
    AND (file_path LIKE ((SELECT auth.uid())::text || '/%') OR (SELECT public.get_my_role()) = 'admin')
    AND EXISTS (SELECT 1 FROM public.tickets AS t WHERE t.id = ticket_attachments.ticket_id)
  );

DROP POLICY IF EXISTS "Uploaders and staff can remove attachments" ON public.ticket_attachments;
CREATE POLICY "Uploaders and staff can remove attachments"
  ON public.ticket_attachments FOR DELETE TO authenticated
  USING (
    uploaded_by = (SELECT auth.uid())
    OR (SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk')
  );

-- 7.12 time_entries
DROP POLICY IF EXISTS "Members can view time entries" ON public.time_entries;
CREATE POLICY "Members can view time entries"
  ON public.time_entries FOR SELECT TO authenticated
  USING (
    (SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk', 'branch_manager')
    OR technician_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Team members can log their own time" ON public.time_entries;
CREATE POLICY "Team members can log their own time"
  ON public.time_entries FOR INSERT TO authenticated
  WITH CHECK (
    technician_id = (SELECT auth.uid())
    AND (SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk', 'branch_manager')
  );

DROP POLICY IF EXISTS "Owners and staff can edit time entries" ON public.time_entries;
CREATE POLICY "Owners and staff can edit time entries"
  ON public.time_entries FOR UPDATE TO authenticated
  USING (
    ((SELECT public.get_my_role()) IS NOT NULL AND technician_id = (SELECT auth.uid()))
    OR (SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk')
  )
  WITH CHECK (
    ((SELECT public.get_my_role()) IS NOT NULL AND technician_id = (SELECT auth.uid()))
    OR (SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk')
  );

DROP POLICY IF EXISTS "Owners and staff can delete time entries" ON public.time_entries;
CREATE POLICY "Owners and staff can delete time entries"
  ON public.time_entries FOR DELETE TO authenticated
  USING (
    ((SELECT public.get_my_role()) IS NOT NULL AND technician_id = (SELECT auth.uid()))
    OR (SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk')
  );

-- 7.13 notifications
-- Triggers create all other notification types (they bypass RLS). The app
-- itself only inserts @mention notifications, always with actor_id = the
-- sender and on a ticket the sender can see, so that is all the API allows.
-- Deactivated accounts cannot read their notifications.
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND (SELECT public.get_my_role()) IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Team members can send mentions as themselves" ON public.notifications;
CREATE POLICY "Team members can send mentions as themselves"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = (SELECT auth.uid())
    AND type = 'mention'
    AND (SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk', 'branch_manager')
    AND ticket_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.tickets AS t WHERE t.id = notifications.ticket_id)
  );

-- 7.14 audit_logs (read-only; written by SECURITY DEFINER functions)
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING ((SELECT public.get_my_role()) = 'admin');

-- 7.15 sla_policies
DROP POLICY IF EXISTS "Members can view SLA policies" ON public.sla_policies;
CREATE POLICY "Members can view SLA policies"
  ON public.sla_policies FOR SELECT TO authenticated
  USING ((SELECT public.get_my_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage SLA policies" ON public.sla_policies;
CREATE POLICY "Admins can manage SLA policies"
  ON public.sla_policies FOR ALL TO authenticated
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');

-- 7.16 approval_gates
DROP POLICY IF EXISTS "Members can view approval gates" ON public.approval_gates;
CREATE POLICY "Members can view approval gates"
  ON public.approval_gates FOR SELECT TO authenticated
  USING ((SELECT public.get_my_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Admins can manage approval gates" ON public.approval_gates;
CREATE POLICY "Admins can manage approval gates"
  ON public.approval_gates FOR ALL TO authenticated
  USING ((SELECT public.get_my_role()) = 'admin')
  WITH CHECK ((SELECT public.get_my_role()) = 'admin');

-- 7.17 ticket_relationships
DROP POLICY IF EXISTS "Team members can view ticket relationships" ON public.ticket_relationships;
CREATE POLICY "Team members can view ticket relationships"
  ON public.ticket_relationships FOR SELECT TO authenticated
  USING ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk', 'branch_manager'));

DROP POLICY IF EXISTS "Staff can manage ticket relationships" ON public.ticket_relationships;
CREATE POLICY "Staff can manage ticket relationships"
  ON public.ticket_relationships FOR ALL TO authenticated
  USING ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk'));

-- 7.18 milestones
DROP POLICY IF EXISTS "Members can view milestones" ON public.milestones;
CREATE POLICY "Members can view milestones"
  ON public.milestones FOR SELECT TO authenticated
  USING ((SELECT public.get_my_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Staff and branch managers can manage milestones" ON public.milestones;
CREATE POLICY "Staff and branch managers can manage milestones"
  ON public.milestones FOR ALL TO authenticated
  USING ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk', 'branch_manager'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk', 'branch_manager'));

-- 7.19 releases and release_tickets
DROP POLICY IF EXISTS "Members can view releases" ON public.releases;
CREATE POLICY "Members can view releases"
  ON public.releases FOR SELECT TO authenticated
  USING ((SELECT public.get_my_role()) IS NOT NULL);

DROP POLICY IF EXISTS "Admins and developers can manage releases" ON public.releases;
CREATE POLICY "Admins and developers can manage releases"
  ON public.releases FOR ALL TO authenticated
  USING ((SELECT public.get_my_role()) IN ('admin', 'developer'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'developer'));

DROP POLICY IF EXISTS "Team members can view release tickets" ON public.release_tickets;
CREATE POLICY "Team members can view release tickets"
  ON public.release_tickets FOR SELECT TO authenticated
  USING ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk', 'branch_manager'));

DROP POLICY IF EXISTS "Admins and developers can manage release tickets" ON public.release_tickets;
CREATE POLICY "Admins and developers can manage release tickets"
  ON public.release_tickets FOR ALL TO authenticated
  USING ((SELECT public.get_my_role()) IN ('admin', 'developer'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'developer'));

-- 7.20 kb_articles (drafts are staff-only)
DROP POLICY IF EXISTS "Members can view published articles; staff can view all" ON public.kb_articles;
CREATE POLICY "Members can view published articles; staff can view all"
  ON public.kb_articles FOR SELECT TO authenticated
  USING (
    (is_published AND (SELECT public.get_my_role()) IS NOT NULL)
    OR (SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk')
  );

DROP POLICY IF EXISTS "Staff can manage articles" ON public.kb_articles;
CREATE POLICY "Staff can manage articles"
  ON public.kb_articles FOR ALL TO authenticated
  USING ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk'))
  WITH CHECK ((SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk'));


-- =============================================================================
-- 8. STORAGE
-- =============================================================================
-- Both buckets are public because the app stores public URLs: avatar_url on
-- profiles, and inline images and file links inside ticket descriptions,
-- comments and knowledge base articles. Public buckets serve files by URL
-- without any policy, so there is deliberately no anonymous SELECT policy
-- (that would let anyone list every file).
--
-- Object paths used by the app:
--   avatars/<user id>-<random>.<ext>
--   ticket_attachments/<user id>/<timestamp>-<random>_<file name>
--   ticket_attachments/comment-attachments/<timestamp>-<random>_<file name>

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',            'avatars',            true, 5242880,  ARRAY['image/*']),  -- 5 MB, images only
  ('ticket_attachments', 'ticket_attachments', true, 52428800, NULL)             -- 50 MB, any file type
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage policies from earlier, pre-release FlowDesk scripts. Policies are
-- OR'ed together, so these would let anyone list or overwrite files despite
-- the policies below. They only exist on databases set up with those scripts.
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatars." ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars." ON storage.objects;
DROP POLICY IF EXISTS "Public Ticket Attachments View" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;

-- Reading an object is needed for signed download links and removal (listing
-- a folder also needs it). Any member can read avatars. Ticket files are
-- readable by staff, by the member who uploaded them, and by anyone who can
-- see an attachment row for them (the sub-select on public.ticket_attachments
-- runs under the caller's own RLS). Other members therefore cannot list files
-- embedded in internal notes or draft articles.
DROP POLICY IF EXISTS "FlowDesk members can read files" ON storage.objects;
CREATE POLICY "FlowDesk members can read files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    (bucket_id = 'avatars' AND (SELECT public.get_my_role()) IS NOT NULL)
    OR (
      bucket_id = 'ticket_attachments'
      AND (
        (SELECT public.get_my_role()) IN ('admin', 'developer', 'support_desk')
        OR ((SELECT public.get_my_role()) IS NOT NULL AND owner_id = (SELECT auth.uid())::text)
        OR EXISTS (SELECT 1 FROM public.ticket_attachments AS a WHERE a.file_path = objects.name)
      )
    )
  );

-- Avatars sit at the bucket root and must start with the uploader's user id.
DROP POLICY IF EXISTS "FlowDesk members can upload their own avatar" ON storage.objects;
CREATE POLICY "FlowDesk members can upload their own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND name LIKE ((SELECT auth.uid())::text || '-%')
    AND (SELECT public.get_my_role()) IS NOT NULL
  );

DROP POLICY IF EXISTS "FlowDesk members can upload ticket attachments" ON storage.objects;
CREATE POLICY "FlowDesk members can upload ticket attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket_attachments'
    AND (SELECT public.get_my_role()) IS NOT NULL
  );

DROP POLICY IF EXISTS "FlowDesk owners and admins can update files" ON storage.objects;
CREATE POLICY "FlowDesk owners and admins can update files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('avatars', 'ticket_attachments')
    AND (owner_id = (SELECT auth.uid())::text OR (SELECT public.get_my_role()) = 'admin')
  )
  WITH CHECK (
    bucket_id IN ('avatars', 'ticket_attachments')
    AND (owner_id = (SELECT auth.uid())::text OR (SELECT public.get_my_role()) = 'admin')
  );

-- Matches who can remove an attachment row: the uploader or staff. Admins can
-- delete any file in either bucket.
DROP POLICY IF EXISTS "FlowDesk owners and staff can delete files" ON storage.objects;
CREATE POLICY "FlowDesk owners and staff can delete files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('avatars', 'ticket_attachments')
    AND (
      owner_id = (SELECT auth.uid())::text
      OR (SELECT public.get_my_role()) = 'admin'
      OR (bucket_id = 'ticket_attachments'
          AND (SELECT public.get_my_role()) IN ('developer', 'support_desk'))
    )
  );


-- =============================================================================
-- 9. REALTIME
-- =============================================================================
-- Live updates for the boards, the notification bell and the comment feed.
-- Realtime still applies the RLS policies above to every event it sends.
DO $$
DECLARE
  v_table text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE 'Publication supabase_realtime not found; skipping realtime setup.';
    RETURN;
  END IF;

  FOREACH v_table IN ARRAY ARRAY['tickets', 'notifications', 'ticket_comments'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
    END IF;
  END LOOP;
END
$$;

-- Lets realtime deliver comment DELETE events filtered by ticket_id.
ALTER TABLE public.ticket_comments REPLICA IDENTITY FULL;


-- =============================================================================
-- 10. DEFAULT SETTINGS
-- =============================================================================
-- Generic defaults an admin can change under Admin -> SLA and Admin -> Gates.
-- Existing rows are never overwritten.

-- SLA targets in hours. The Admin panel edits these rows but cannot add new ones.
INSERT INTO public.sla_policies (priority, response_time_hours, resolution_time_hours)
VALUES
  ('critical', 1, 4),
  ('high', 4, 24),
  ('medium', 8, 72),
  ('low', 24, 168)
ON CONFLICT (priority) DO NOTHING;

-- Approval gates:
--   Ready for Dev -> In Progress needs admin approval
--   Approved (beta_testing) -> Released (done) needs customer approval
--   Awaiting Customer Approval -> Ready for Dev needs customer approval
INSERT INTO public.approval_gates (from_status, to_status, requires_admin_approval, requires_customer_approval)
VALUES
  ('ready_for_dev', 'dev_in_progress', true, false),
  ('beta_testing', 'done', false, true),
  ('awaiting_customer_approval', 'ready_for_dev', false, true)
ON CONFLICT (from_status, to_status) DO NOTHING;

-- Ask the Data API to pick up the new tables and relationships right away.
NOTIFY pgrst, 'reload schema';
