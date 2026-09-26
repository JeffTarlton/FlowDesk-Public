# Changelog

All notable changes to FlowDesk are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-09-26

Initial public release of FlowDesk under the MIT License.

### Added

**Tickets**

- Tickets with readable numbers (`FLD-0001`, `FLD-0002`, ...), seven types (bug, feature request, project, task, documentation, improvement, professional service), four priorities and a 14-status workflow, including four on-hold reasons.
- Rich-text descriptions, acceptance criteria and comments with inline images, `@mentions` and staff-only internal notes.
- File attachments (up to 50 MB each), watchers, linked tickets (related, duplicate, blocks / blocked by), project tickets with child tasks, and a blocked flag with a reason.
- A ticket detail panel with an activity feed, live comments, presence avatars showing who else is viewing, and PDF export.

**Planning and tracking**

- Kanban board with drag and drop, and a Backlog with filters, sorting, saved views and "load more".
- My Work with pinned tickets, a ticket analytics Dashboard, and a Calendar with an assignee Timeline view (the Timeline can use an optional FullCalendar Premium license key).
- Products, Milestones (progress and overdue badges) and Releases (planned to released or rolled back, with their tickets).
- Time tracking: live timers (one running timer per person), manual time logs with `1w 2d 4h` style input, and a weekly Timesheet.

**Service management**

- SLA policies per priority, with response and resolution deadlines and breach tracking.
- Configurable approval gates that require admin and/or customer approval for selected status changes.
- A Support Portal where branch managers and the support desk submit and follow requests.
- A Knowledge Base with categories, tags, drafts, view counts and a full-text search index.

**Insights**

- An admin-only Executive dashboard with KPIs and charts over a selectable date range.
- Admin-only Reports (SLA compliance, team workload, milestone progress, release history, time by technician, aging tickets) with copy-to-clipboard and PDF export.

**Collaboration and interface**

- In-app notifications for status changes, assignments, comments and mentions, delivered live through Supabase Realtime.
- A command palette (Ctrl+K or Cmd+K) to search tickets and jump between pages.
- Light and dark mode, six color themes, and a simplified layout for small screens.

**Administration**

- An Admin panel with Users, All Tickets, Analytics, Branches, Audit Logs, Products, SLA and Gates tabs.
- User management: invite users with a one-time temporary password, assign roles (admin, developer, support desk, branch manager) and branches, deactivate, force a password reset, or delete permanently.
- "View as" to preview the app as another user's role.
- An audit log of role changes, activations, ticket deletions and user deletions.

**Open-source preparation**

- A single, idempotent schema migration (`supabase/migrations/20260926000000_flowdesk_schema.sql`) that builds all tables, functions, triggers, RLS policies, storage buckets, realtime settings and default SLA and approval-gate settings on a fresh Supabase project.
- A seed migration (`20260926000100_seed_admin.sql`) that creates the default admin account, `admin@flowdesk.com`, flagged to change its password at the first sign-in.
- `supabase/config.toml` for running the full stack locally with the Supabase CLI.
- The `admin-actions` Supabase Edge Function for user creation, password changes and comment deletion.
- Support for both the legacy `anon` key and the new publishable key, plus a "setup required" screen when the environment variables are missing.
- Vercel configuration (`vercel.json`) for single-page-app routing.
- Documentation for installing FlowDesk on a free Supabase project and a free Vercel account, the architecture, known issues, contributing and security, plus issue and pull request templates.

### Security

- Row Level Security on every table, with no access at all for signed-out (`anon`) users.
- Role checks through `SECURITY DEFINER` helper functions that return no role for deactivated accounts, so deactivation blocks access to shared data in the database, not only in the UI.
- Triggers that stop non-admins from changing privileged profile columns (role, active status, password reset flag, branch, email) and from granting admin approval or changing a ticket number.
- A first-login password reset that cannot be skipped: the flag is cleared only by the Edge Function after the password has changed, and the published default password is rejected.
- The `admin-actions` Edge Function verifies the caller's token, requires an active profile and checks the role for every action. It reads the new secret keys, with a fallback to the legacy `service_role` key.
- Storage policies that stop bucket listing by anonymous users, restrict avatar uploads to the user's own file names, and tie attachment rows to the uploader's own folder.
- Accounts not created by an admin start deactivated, and the local configuration disables public sign-ups.
- Every database function pins its `search_path`, and user-supplied HTML is sanitized before it is displayed.

[Unreleased]: https://github.com/JeffTarlton/FlowDesk-Public/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/JeffTarlton/FlowDesk-Public/releases/tag/v1.0.0
