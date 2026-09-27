# Known Issues and Limitations

This is an honest list of what does not work yet, or works differently from what the UI suggests. It is written for contributors: every entry says what happens, where the code lives, and a suggested approach. Entries marked **good first issue** are small and self-contained.

Before you start on one, check the [issue tracker](https://github.com/JeffTarlton/FlowDesk-Public/issues) and comment there so nobody duplicates the work. [CONTRIBUTING.md](../CONTRIBUTING.md) explains the development setup and pull request process, and [ARCHITECTURE.md](ARCHITECTURE.md) explains how the code is organised. **Report security vulnerabilities privately** as described in [SECURITY.md](../SECURITY.md), not in a public issue.

Line numbers were accurate when this page was written; search for the quoted names if they have moved.

**Severity**

| Level | Meaning |
|---|---|
| High | Wrong results or a broken workflow in normal use. |
| Medium | Misleading behaviour, a rule that is not enforced everywhere, or a noticeable gap. |
| Low | A rough edge, a cosmetic problem, or something that only matters in rare cases. |

## Summary

| Area | Issue | Severity | Good first issue |
|---|---|---|---|
| Data loading | [Most views only load the newest 50 tickets](#most-views-only-load-the-newest-50-tickets) | High | |
| Data loading | [Some pages show the shared ticket list without loading it](#some-pages-show-the-shared-ticket-list-without-loading-it) | Medium | Yes |
| Workflow | [Approval gates are enforced in the browser only](#approval-gates-are-enforced-in-the-browser-only) | Medium | |
| Workflow | [Five statuses have no Kanban column](#five-statuses-have-no-kanban-column) | Medium | |
| Workflow | [Edits the database refuses can look successful](#edits-the-database-refuses-can-look-successful) | Medium | |
| Workflow | [Status changes from the ticket panel are not logged](#status-changes-from-the-ticket-panel-are-not-logged) | Low | Yes |
| Workflow | [Admin "All Tickets" table shortcuts](#admin-all-tickets-table-shortcuts) | Low | Yes |
| Workflow | [Branch managers' Kanban tickets get no branch](#branch-managers-kanban-tickets-get-no-branch) | Low | Yes |
| Workflow | [A Task cannot be created on its own](#a-task-cannot-be-created-on-its-own) | Low | |
| Dates | [Dashboard and Support Portal read due dates in local time](#dashboard-and-support-portal-read-due-dates-in-local-time) | Low | Yes |
| SLA | [SLA breach notifications are not implemented](#sla-breach-notifications-are-not-implemented) | Medium | |
| SLA | [The SLA Resolution KPI always shows 0](#the-sla-resolution-kpi-always-shows-0) | Low | Yes |
| SLA | [Some "SLA" labels are not based on SLA data](#some-sla-labels-are-not-based-on-sla-data) | Low | Yes |
| SLA | [Only leaving Intake counts as the first response](#only-leaving-intake-counts-as-the-first-response) | Low | |
| SLA | [Editing an SLA policy does not update open tickets](#editing-an-sla-policy-does-not-update-open-tickets) | Low | |
| Security and admin | [Impersonation changes menus only](#impersonation-changes-menus-only) | Medium | |
| Security and admin | [Files embedded in text use public links](#files-embedded-in-text-use-public-links) | Medium | |
| Security and admin | [Deleted tickets and removed inline files stay in storage](#deleted-tickets-and-removed-inline-files-stay-in-storage) | Medium | |
| Security and admin | [admin-actions returns HTTP 200 for errors](#admin-actions-returns-http-200-for-errors) | Low | |
| Security and admin | [Invite User silently recovers existing accounts](#invite-user-silently-recovers-existing-accounts) | Low | |
| Security and admin | [Force Password Reset has weak checks](#force-password-reset-has-weak-checks) | Low | Yes |
| Security and admin | [Password rules are enforced only by the Edge Function](#password-rules-are-enforced-only-by-the-edge-function) | Low | |
| Security and admin | [Deactivated users can still edit their own profile](#deactivated-users-can-still-edit-their-own-profile) | Low | |
| Security and admin | [Invites and the seeded admin are audit-logged without an actor](#invites-and-the-seeded-admin-are-audit-logged-without-an-actor) | Low | |
| Security and admin | [Users and Audit Logs tab rough edges](#users-and-audit-logs-tab-rough-edges) | Low | Yes |
| Security and admin | [The customer role has no user interface](#the-customer-role-has-no-user-interface) | Low | |
| Notifications | [Clicking a notification does not open the ticket](#clicking-a-notification-does-not-open-the-ticket) | Low | Yes |
| Notifications | [No "Mark all as read" button](#no-mark-all-as-read-button) | Low | Yes |
| Notifications | [Portal requesters are not notified](#portal-requesters-are-not-notified) | Low | Yes |
| Notifications | [Mentions in the Support Portal do not notify](#mentions-in-the-support-portal-do-not-notify) | Low | Yes |
| Navigation | [Command palette and shortcut quirks](#command-palette-and-shortcut-quirks) | Low | Yes |
| Navigation | [Calendar "Unassigned" filter shows nothing](#calendar-unassigned-filter-shows-nothing) | Low | Yes |
| Lists and board | [Dead buttons on the Kanban board](#dead-buttons-on-the-kanban-board) | Low | Yes |
| Lists and board | [Kanban comment count is always 0](#kanban-comment-count-is-always-0) | Low | Yes |
| Lists and board | [The Kanban board needs horizontal scrolling](#the-kanban-board-needs-horizontal-scrolling) | Low | |
| Lists and board | [Status names and colors differ between screens](#status-names-and-colors-differ-between-screens) | Low | Yes |
| Lists and board | ["Assigned to Me" chip count is always 0](#assigned-to-me-chip-count-is-always-0) | Low | Yes |
| Lists and board | [Admin ticket list shows the creator's email as the customer email](#admin-ticket-list-shows-the-creators-email-as-the-customer-email) | Low | Yes |
| Ticket panel | [Branch managers' comments are labelled "Customer"](#branch-managers-comments-are-labelled-customer) | Low | Yes |
| Ticket panel | [Cosmetic glitches](#cosmetic-glitches) | Low | Yes |
| Time tracking | [Billed hours can be overwritten](#billed-hours-can-be-overwritten) | Low | |
| Knowledge Base | [KB search does not use the full-text index](#kb-search-does-not-use-the-full-text-index) | Low | Yes |
| Knowledge Base | [Knowledge Base card previews run text together](#knowledge-base-card-previews-run-text-together) | Low | Yes |
| Support Portal | [Portal request details are missing the description and product](#portal-request-details-are-missing-the-description-and-product) | Medium | Yes |
| Support Portal | [Portal labels and tracker gaps](#portal-labels-and-tracker-gaps) | Low | Yes |
| Mobile | [Mobile shows a ticket list only](#mobile-shows-a-ticket-list-only) | Medium | |
| Calendar | [Timeline view depends on a FullCalendar Premium plugin](#timeline-view-depends-on-a-fullcalendar-premium-plugin) | Low | |
| Code health | [Large JavaScript bundle](#large-javascript-bundle) | Medium | Yes |
| Code health | [No automated tests](#no-automated-tests) | Medium | Yes |
| Code health | [About 93 ESLint errors](#about-93-eslint-errors) | Low | Yes |
| Code health | [Browser alert() dialogs for errors](#browser-alert-dialogs-for-errors) | Low | Yes |
| Code health | [React Router future-flag warnings in the console](#react-router-future-flag-warnings-in-the-console) | Low | Yes |
| Code health | [Local Supabase stack on Windows: a log container keeps restarting](#local-supabase-stack-on-windows-a-log-container-keeps-restarting) | Low | |

---

## Data loading and scale

### Most views only load the newest 50 tickets

**Severity:** High

**What happens.** The shared ticket store loads the 50 most recently *created* tickets. Only the Backlog has a **Load more tickets** button. Every other screen works on whatever the store holds, so once you have more than 50 tickets:

- Older tickets are missing from the Kanban board, **My Work** (an old ticket assigned to you does not appear), the Calendar, the Dashboard, the Product Catalog and the mobile list.
- The command palette, the "Link" and "blocked by" pickers, **Link Existing** for dev tasks, the parent picker in the new-ticket form and the Releases "add ticket" search cannot find older tickets.
- The Executive dashboard and Reports under-count.

The opposite problem exists on **Admin Panel > All Tickets**, which loads every ticket in one request.

**Where.**
- `src/store/useTicketStore.ts:7` (`PAGE_SIZE = 50`), `fetchTickets` at `:39`, `loadMoreTickets` at `:61`.
- "Load more" button: `src/pages/Backlog.tsx:410`.
- Unbounded admin query: `fetchTickets` in `src/store/useAdminStore.ts:149`.

**Suggested approach.** Give each view the query it needs instead of sharing one page of tickets: for example My Work filters on `assigned_to` and status on the server; the palette and pickers search the server (`ilike`, or full-text search); Executive and Reports aggregate in Postgres (a view or an RPC) instead of in the browser. Keep the shared store as a realtime cache. Paginate the admin list.

### Some pages show the shared ticket list without loading it

**Severity:** Medium · **good first issue**

**What happens.** The Dashboard, Calendar, Milestones ticket list, Releases "add ticket" search, the command palette and the mobile list read the shared ticket store but never call `fetchTickets`. They rely on another page, or on the session-recovery event, having filled it. After a hard reload on one of these pages (for example `/dashboard`, a branch manager's home page), lists and charts can be empty until the user visits the Kanban board or Backlog.

The branch pickers in the new-ticket form and the ticket panel have the same problem: they read `useAdminStore().branches`, which is only loaded by the Admin Panel, Edit Profile or session recovery.

**Where.** `src/pages/Dashboard.tsx:22`, `src/pages/CalendarTimeline.tsx:36`, `src/pages/MilestonesPage.tsx:17`, `src/pages/ReleasesPage.tsx:18`, `src/components/CommandPalette.tsx:35`, `src/components/MobileDashboard.tsx:12`; branches in `src/components/NewTicketModal.tsx:26` and `src/components/TicketDetailPanel.tsx:117`. The recovery path is `src/hooks/useSessionRecovery.ts:25`.

**Suggested approach.** Add a small `useEnsureTickets()` hook that calls `fetchTickets()` when the store is empty, and use it on those pages. Call `fetchBranches()` when the branch list is empty in the two ticket components.

---

## Workflow and approvals

### Approval gates are enforced in the browser only

**Severity:** Medium

**What happens.** The ticket panel's **Status** dropdown and Kanban drags check approval gates, but only in the browser. Apart from "only an admin may grant admin approval", the database does not know about gates. A status change made through **Admin Panel > All Tickets**, or directly through the API by any user who may edit the ticket, skips gates and the "Acceptance Criteria required before closing" rule. The Admin dropdown also writes no activity log entry. This is also listed under "Known design limits" in [SECURITY.md](../SECURITY.md).

**Where.** Client checks: `canTransition` in `src/store/useApprovalStore.ts:97`, used by `handleStatusChange` in `src/components/TicketDetailPanel.tsx:440-461` and `handleDragEnd` in `src/pages/KanbanBoard.tsx:177-188`. Bypass: `updateTicketStatus` in `src/store/useAdminStore.ts:231` (called from `src/pages/Admin.tsx:524-538`). The only server rule: `guard_ticket_privileged_columns` in `supabase/migrations/20260926000000_flowdesk_schema.sql:725-753`.

**Suggested approach.** Add a `BEFORE UPDATE` trigger on `public.tickets` that, when `status` changes and `current_user` is `authenticated`, looks up an active row in `approval_gates` for `(OLD.status, NEW.status)` and raises an error if the approvals are missing, and rejects `done` without acceptance criteria. Follow the pattern of the existing guard triggers so trusted paths (SQL editor, service role) still work. Put it in a new timestamped migration, and make the UI show the database's error message.

### Five statuses have no Kanban column

**Severity:** Medium

**What happens.** **Planning**, **SOW In Progress**, **Awaiting Customer Approval**, **In Review** and **Rejected** can be set from the ticket panel, but the board has no column for them, so those tickets vanish from the board. They still appear in the Backlog and My Work.

**Where.** `COLUMNS` in `src/types/index.ts:162-169`; the column filter in `src/pages/KanbanBoard.tsx:77`.

**Suggested approach.** Decide on a mapping and document it. One option: map Planning, SOW In Progress and Awaiting Customer Approval into the Intake column (with a status chip on the card, as on-hold tickets have), map In Review into In Progress, and add a collapsible "Rejected" column. Grouped columns need a way to choose the exact status on drop, like the On-Hold dialog in `src/components/OnHoldModal.tsx`.

### Edits the database refuses can look successful

**Severity:** Medium

**What happens.** Ticket edits are applied to the screen first (optimistic updates). When row level security filters a row out, PostgREST returns success with zero rows changed, not an error, so the change stays on screen until the next reload. Examples: a branch manager editing or deleting a ticket that is not from their branch, or deleting any ticket. The ticket panel also shows controls that some roles cannot use: **Delete** and **Link** for branch managers, and the **New Release** button for support desk (that one does show an error).

Attachments have the same problem. The trash icon in the **Attachments** section is shown to every role, but only the uploader and staff may remove a file. For anyone else, storage and the database both remove nothing, yet the panel shows "Attachment removed"; the file and its row are still there after a reload.

**Where.** `updateTicketFields` and `deleteTicket` in `src/store/useTicketStore.ts:132-168`; `handleRemoveAttachment` in `src/components/TicketDetailPanel.tsx:520-530`, which ignores the `{ error }` results of `storage.remove` and of the row delete; the controls in `src/components/TicketDetailPanel.tsx` (footer **Delete**, **Link** in Linked Tickets, the attachment trash icon).

**Suggested approach.** Add `.select('id')` to updates and deletes and treat an empty result as "not permitted": roll back and show a toast. Check the results in `handleRemoveAttachment` the same way. Hide controls the current role cannot use (see the roles table in [GETTING_STARTED.md](GETTING_STARTED.md#5-roles-and-permissions)), including the attachment trash icon for users who are neither the uploader nor staff.

### Status changes from the ticket panel are not logged

**Severity:** Low · **good first issue**

**What happens.** Moving a ticket on the Kanban board writes "Moved request to ..." to its activity log. Changing the **Status** dropdown in the ticket panel writes nothing, so the history is incomplete. The automatic move from **Awaiting Customer Approval** to **Ready for Dev**, made by a database trigger when the customer approval is recorded, is not logged either: the feed only shows "Granted Customer approval".

**Where.** `handleStatusChange` in `src/components/TicketDetailPanel.tsx:440-461` calls `updateTicketFields`, which only logs assignment changes (`src/store/useTicketStore.ts:144-168`). Kanban uses `updateTicketStatus` (`:95-130`). The automatic move: `approveTicket` in `src/store/useTicketStore.ts:269` and the `ticket_auto_ready_for_dev` trigger (`handle_customer_approval_trigger`) in `supabase/migrations/20260926000000_flowdesk_schema.sql`.

**Suggested approach.** Quick fix: call `updateTicketStatus` from the panel. Better: write status-change log rows in a database trigger, which also covers the automatic customer-approval move, the Admin dropdown and API clients.

### Admin "All Tickets" table shortcuts

**Severity:** Low · **good first issue**

**What happens.** On **Admin Panel > All Tickets**:

- The status dropdown offers only 7 of the 14 statuses. A ticket that is on hold, in SOW, awaiting approval or rejected shows the wrong value in the dropdown.
- The **Type** column shows only "Bug" or "Feature", whatever the type.

**Where.** `statusOptions` in `src/pages/Admin.tsx:78-86`; type badge at `:509-515`; dropdown at `:524-538`.

**Suggested approach.** Use one shared status and type list (see [Status names and colors differ between screens](#status-names-and-colors-differ-between-screens)).

### Branch managers' Kanban tickets get no branch

**Severity:** Low · **good first issue**

**What happens.** Branch managers can use **New Ticket** on the Kanban board, but the branch field is only shown to admins and developers. Their ticket is saved without a branch, so it does not appear in their Support Portal and they cannot edit it afterwards (branch managers may only edit their own branch's tickets).

**Where.** `src/components/NewTicketModal.tsx:332` (field visibility) and the insert at `:77-94`.

**Suggested approach.** When the creator is a branch manager, set `branch_id` to their branch, as `src/components/BranchRequestModal.tsx:37-47` does.

### A Task cannot be created on its own

**Severity:** Low

**What happens.** In the new-ticket form, choosing the type **Task** makes **Parent Ticket** a required field, and the list only offers top-level tickets that are already loaded. A Task therefore cannot stand alone, and cannot be the first ticket in a new installation. The form does not explain why.

**Where.** The two Parent Ticket fields in `src/components/NewTicketModal.tsx:348-362` and `:385-400`.

**Suggested approach.** Either make the parent optional, or add a hint in the form that a Task must belong to a parent ticket (and suggest another type when there is none).

---

## Dates

### Dashboard and Support Portal read due dates in local time

**Severity:** Low · **good first issue**

**What happens.** Ticket target dates are calendar days, stored at noon UTC. The ticket panel and the Calendar read them back by their UTC day, and milestone and release dates are parsed as local dates, so most screens show the right day everywhere. Two screens still convert the stored value to local time:

- The **Dashboard** shows due dates with `new Date(...).toLocaleDateString()`, and counts a ticket as **Overdue** as soon as `new Date(due) < now`. A ticket therefore turns Overdue at 12:00 UTC on its due date, not after the end of that day.
- The Support Portal's request details (**Delivery Roadmap**) format the target dates with `format(new Date(...))`.

In time zones at UTC+12 or later, both screens show the next day.

**Where.** `src/pages/Dashboard.tsx:35-39` (Overdue card), `:259-261` (overdue check in the drill-down window), and the due-date labels at `:289` and `:429`; `src/components/CustomerTicketDetail.tsx:348`, `:356` and `:364`. The correct handling is `toStoredDay` / `fromStoredDay` in `src/components/TicketDetailPanel.tsx:27-43`.

**Suggested approach.** Move `fromStoredDay` into a shared helper and use it on both screens. Count a ticket as Overdue only after the end of its due day.

---

## SLA

### SLA breach notifications are not implemented

**Severity:** Medium

**What happens.** The help box on **Admin Panel > SLA** says "Breaches trigger in-app notifications to the assignee and all watchers." Nothing sends them. Breach flags themselves are only written at the moment a ticket leaves Intake (response) or reaches Released / Closed (resolution), not when a deadline passes.

**Where.** Help text: `src/pages/Admin.tsx:1168`. Flags: `track_first_response` in `supabase/migrations/20260926000000_flowdesk_schema.sql:846-867`.

**Suggested approach.** Add a scheduled job with Supabase Cron (`pg_cron`, available on the free plan) that runs every few minutes, finds open tickets whose response or resolution deadline has passed and have not been notified yet, and inserts `system` notifications for the assignee and watchers. Track what was already sent (a column or a small table) so each breach is notified once. Until then, a quick **good first issue** is to correct the help text.

### The SLA Resolution KPI always shows 0

**Severity:** Low · **good first issue**

**What happens.** The Executive dashboard's **SLA Resolution** card counts *open* tickets with `sla_resolution_breached = true`, but that flag is only set when a ticket is closed. The card therefore shows 0.

**Where.** `src/pages/ExecutiveDashboard.tsx:85`.

**Suggested approach.** Count open tickets whose `sla_resolution_deadline` has passed, as the Dashboard's SLA Breach card does (`src/pages/Dashboard.tsx:42-47`).

### Some "SLA" labels are not based on SLA data

**Severity:** Low · **good first issue**

**What happens.**
- **Admin Panel > Analytics > SLA Health** is the share of tickets updated in the last 5 days, not an SLA measure. The **At Risk** card ("Tickets nearing breach") counts tickets with no update for more than 5 days.
- The orange "SLA Breach" icon in the Backlog and My Work marks tickets that have been in Intake for more than 3 days, a fixed rule unrelated to the SLA settings.

**Where.** `src/pages/Admin.tsx:88-93` (`isTicketStuck`), `:567-587`; `src/pages/Backlog.tsx:345`; `src/pages/MyWork.tsx:90`.

**Suggested approach.** Either compute these from `sla_response_deadline` / `sla_resolution_deadline`, or rename them ("Activity", "Stale", "Waiting in Intake").

### Only leaving Intake counts as the first response

**Severity:** Low

**What happens.** The response SLA clock stops only when a ticket's status leaves **Intake / New Request**. A public reply from the team, or assigning the ticket, does not count as a first response, so a ticket that was answered quickly but left in Intake still breaches its response target.

**Where.** `track_first_response` in `supabase/migrations/20260926000000_flowdesk_schema.sql:846-867`, which sets `first_responded_at` only when the status leaves `pending`.

**Suggested approach.** In a new migration, also stamp `first_responded_at` (and the breach flag) from the comment trigger when a staff member posts a public reply, and optionally on the first assignment. Document the chosen rule in the SLA tab's help text.

### Editing an SLA policy does not update open tickets

**Severity:** Low

**What happens.** Deadlines are computed when a ticket is created and when its priority changes. Changing a policy's hours or disabling it affects new tickets only. This is intentional but surprising.

**Where.** `compute_sla_deadlines` and `recompute_sla_on_priority_change` in `supabase/migrations/20260926000000_flowdesk_schema.sql:796-842`.

**Suggested approach.** Offer an optional "Apply to open tickets" action on the SLA tab, backed by an admin-only RPC that recalculates deadlines for tickets that are not closed.

---

## Security and administration

### Impersonation changes menus only

**Severity:** Medium

**What happens.** **Impersonate** (the eye icon in **Admin Panel > Users**) swaps the profile held in the browser, so the sidebar and page guards follow the other user's role. Every request still runs with the admin's session: the admin sees admin data, and any change is saved as the admin. The preview also ends unexpectedly: a token refresh (about hourly) or returning to the tab after 2 minutes reloads the admin's own profile while the orange banner stays. Reloading the page ends it, and the banner is not shown on mobile. See also "Known design limits" in [SECURITY.md](../SECURITY.md).

**Where.** `impersonate` / `stopImpersonating` in `src/store/useAuthStore.ts:42-43`; profile reloads at `:91-99` and `:153-158`; button in `src/pages/Admin.tsx:392-401`; banner in `src/layouts/AppLayout.tsx:287-300`.

**Suggested approach.** Rename it to "Preview as role" and make it read-only (block writes while `originalProfile` is set), and skip profile reloads while previewing. Real impersonation would need server-issued tokens for another user and is not recommended.

### Files embedded in text use public links

**Severity:** Medium

**What happens.** Images and files inserted with **Attach** in a description, comment (including internal notes) or knowledge base article are stored as public storage URLs. Anyone who has the exact link can open the file without signing in. Files in the ticket **Attachments** panel open through short-lived signed links, but the buckets are public, so those files are reachable by URL too. Details and mitigations are in [SECURITY.md](../SECURITY.md#6-attachments-are-public-by-url).

**Where.** `getPublicUrl` in `src/components/RichTextEditor.tsx:41`; bucket definitions in `supabase/migrations/20260926000000_flowdesk_schema.sql:1792-1799`.

**Suggested approach.** Make `ticket_attachments` private, store the storage path in the HTML (for example a `data-path` attribute), and replace it with a signed URL when the content is rendered. Avatars can stay public. While the paths are public, consider building them with `crypto.randomUUID()` instead of the current timestamp and 4-character random part, so they are harder to guess.

### Deleted tickets and removed inline files stay in storage

**Severity:** Medium

**What happens.** Deleting a ticket removes its database rows (comments, attachment rows, time entries and so on cascade), but never the files in the `ticket_attachments` bucket. Deleting a comment or a knowledge base article does not remove files inserted into it either. Files inserted with the editor's **Attach** button (stored under `comment-attachments/`) have no delete control anywhere in the app: removing the image or link from the text leaves the file in the bucket. Because the bucket is public, all of these files stay reachable by anyone who has the URL. This contradicts the advice in [SECURITY.md](../SECURITY.md#6-attachments-are-public-by-url) to delete a file to revoke access; today only the attachment panel's trash icon, or an admin in the Supabase **Storage** dashboard, removes a file.

**Where.** `deleteTicket` in `src/store/useTicketStore.ts:132-142`; editor uploads in `handleFileUpload`, `src/components/RichTextEditor.tsx:24-45`.

**Suggested approach.** Remove a ticket's attachment objects before or when the ticket is deleted (from the client with `storage.remove`, or in an Edge Function using the service role). Track editor uploads (for example in a table with the ticket, comment or article they belong to) so they can be cleaned up when that content is deleted, and offer a periodic clean-up of objects no row refers to.

### admin-actions returns HTTP 200 for errors

**Severity:** Low (intentional for now)

**What happens.** The `admin-actions` Edge Function always answers HTTP 200 and puts failures in `{ error: "..." }`. This keeps error messages visible in the UI, because the call sites read `data.error`, but it hides failures from HTTP monitoring and from anyone calling the function directly. The intended status (400, 401, 403, 404, 409 or 500) is only written to the function logs.

**Where.** `supabase/functions/admin-actions/index.ts:25-28`, `jsonResponse` at `:60-65`, catch block at `:342-348`. Call sites: `src/components/NewUserModal.tsx:81-82`, `src/components/ForcePasswordResetModal.tsx:37-46`, `src/components/TicketDetailPanel.tsx:251-255`, and the direct `fetch` in `forcePasswordReset` (`src/store/useAdminStore.ts:250`). Error mapping: `src/lib/edgeFunctionError.ts`.

**Suggested approach.** In supabase-js, a non-2xx response arrives as a `FunctionsHttpError` whose `context` is the `Response`, so the body can still be read with `await error.context.json()`. Add a helper that does this, switch all four call sites and `describeAdminActionsError` to it, and only then return real status codes from the function. Ship both halves in one pull request.

### Invite User silently recovers existing accounts

**Severity:** Low

**What happens.** If the email in **Invite User** already belongs to an Auth account without an active profile (a deactivated user, or someone added in the Supabase dashboard), the function takes that account over: it sets the new temporary password, role and branch, and reactivates it. That is usually what an admin wants, but the UI says "User Created!" with no hint that an old account, with its history, was reused. To find the account, the function pages through all Auth users 1000 at a time, which gets slow with many users.

A failed invite also leaves a half-created account behind. If `create-user` fails after the Auth user was created, for example because the profile update is refused for an unknown branch, the Auth user stays with its placeholder profile (inactive, role `customer`). The admin sees the error; retrying the invite then recovers that account as described above.

**Where.** `create-user` in `supabase/functions/admin-actions/index.ts:170-241` (the Auth user is created at `:186-190`, the profile upsert follows at `:225-238`); `findAuthUserByEmail` at `:99-111`; success screen in `src/components/NewUserModal.tsx:95-154`.

**Suggested approach.** Return a `recovered: true` flag and show "An existing account was reactivated" in the modal. Look the user up by email with a service-role-only SQL function over `auth.users` instead of paging through `listUsers`. Validate `branch_id` before calling `createUser`, or delete the new Auth user when the profile upsert fails.

### Force Password Reset has weak checks

**Severity:** Low · **good first issue**

**What happens.**
- The admin types the temporary password in a plain text field; only a 6-character minimum is checked, and the server does not validate it at all.
- Clicking the orange key of a user with a pending reset cancels the reset immediately, with no confirmation and without changing the password.

**Where.** `src/pages/Admin.tsx:402-416` (key button) and `:1357-1362` (length check); `admin-force-password-reset` in `supabase/functions/admin-actions/index.ts:288-312`.

**Suggested approach.** Reuse `generateTempPassword()` from `src/components/NewUserModal.tsx` and show the password once, as Invite User does. Validate length and character classes on the server. Ask for confirmation before cancelling a pending reset.

### Password rules are enforced only by the Edge Function

**Severity:** Low

**What happens.** FlowDesk's password rules (at least 8 characters, a number and a special character, not the published default) are checked by the **Set Your Password** screen and by the `update-password` action of `admin-actions`. A signed-in user can bypass both by calling `supabase.auth.updateUser({ password })` directly and set any password Supabase Auth accepts (6 characters by default). This does **not** clear `force_password_reset`, so the first-login reset still cannot be skipped. (`admin-force-password-reset` does not validate the temporary password either; see [Force Password Reset has weak checks](#force-password-reset-has-weak-checks).)

**Where.** `validateNewPassword` in `supabase/functions/admin-actions/index.ts:89-97`, used only by `update-password` (`:243-286`).

**Suggested approach.** Mitigation, no code change: set matching rules in the Supabase dashboard under **Authentication > Sign In / Providers > Email** (minimum password length 8, which is still compatible with the 10-character temporary passwords from **Invite User**). This is also in the [SECURITY.md hardening checklist](../SECURITY.md#deployment-hardening-checklist). FlowDesk's own check can stay as a friendlier first line.

### Deactivated users can still edit their own profile

**Severity:** Low

**What happens.** Deactivating a user blocks their access to tickets and all other shared data, but a deactivated user can still sign in, and can still change their own **full name**, **phone**, **company name** and **avatar** through the API. The privileged columns (role, active flag, branch, email, password reset flag) stay protected by `guard_profile_privileged_columns`. The notifications UPDATE and DELETE policies do not check for an active account either, although the SELECT policy does, so filtered requests from a deactivated account find no rows.

**Where.** Policy "Users can update their own profile; admins can update any" in `supabase/migrations/20260926000000_flowdesk_schema.sql:1426-1429`; notifications policies at `:1663-1672`.

**Suggested approach.** In a new migration, add `(SELECT public.get_my_role()) IS NOT NULL` to the self-update branch of the profiles UPDATE policy and to the notifications UPDATE and DELETE policies.

### Invites and the seeded admin are audit-logged without an actor

**Severity:** Low

**What happens.** Every **Invite User** writes an audit log row "UPDATE_ROLE customer → *role*" with an empty **Actor**, because `create-user` updates the new profile with the service role, so `auth.uid()` is `NULL` inside the logging trigger. The seed file does the same for the default admin, so a fresh installation already has one such row before anyone signs in.

**Where.** The profile upsert in `create-user`, `supabase/functions/admin-actions/index.ts:225-238`; `log_profile_changes` in `supabase/migrations/20260926000000_flowdesk_schema.sql:663-686`; the seed's profile upsert in `supabase/migrations/20260926000100_seed_admin.sql:93-100`.

**Suggested approach.** Let `create-user` tell the trigger who the calling admin is, for example with `set_config('app.actor_id', ...)` read by `log_profile_changes` when `auth.uid()` is `NULL`, or write its own audit row. Label the seed row as a system action.

### Users and Audit Logs tab rough edges

**Severity:** Low · **good first issue**

**What happens.**
- **Deactivate User** (the ban icon in **Admin Panel > Users**) takes effect immediately, with no confirmation. **Permanently Delete** does ask.
- The **Audit Logs** tab loads its rows once, when the Admin Panel opens, and again only when you click **Refresh**. Role changes, activations, deletions and invites made in the same visit do not appear until then.

**Where.** `src/pages/Admin.tsx:417-423` (deactivate button); `fetchAuditLogs` is called at `:72` (on mount) and by the Refresh button at `:776`.

**Suggested approach.** Ask for confirmation before deactivating, as the delete button does. Call `fetchAuditLogs()` after role, activation, delete and invite actions.

### The customer role has no user interface

**Severity:** Low

**What happens.** The database has a fifth role, `customer`, with policies that let a customer see and comment on tickets whose `customer_email` matches their profile email. The app has no screens for it: a customer sees "No Role Assigned", and the role pickers do not offer it. It is also the placeholder role given to any account not created through **Invite User**.

**Where.** Enum in `supabase/migrations/20260926000000_flowdesk_schema.sql:58-60`; `handle_new_user` at `:556-576`; customer ticket policy at `:1477-1483`. Frontend: `APP_ROLES` in `src/App.tsx:25` and the check at `:63`; `UserRole` in `src/types/index.ts:1`.

**Suggested approach.** Either build a customer portal (a route guarded for `customer` that reuses `src/components/CustomerTicketDetail.tsx` and lists tickets by `customer_email`, plus the role in the pickers and `create-user`), or remove the role in a migration and use a neutral placeholder.

---

## Notifications

### Clicking a notification does not open the ticket

**Severity:** Low · **good first issue**

**What happens.** Clicking a notification only marks it as read, even though each notification stores its `ticket_id`.

**Where.** `src/components/NotificationDropdown.tsx:104-107` (there is a "Future:" comment).

**Suggested approach.** Reuse the command palette's approach: it keeps the chosen ticket's id in state and renders `TicketDetailPanel` on top of the current page (`src/components/CommandPalette.tsx:39-41` and `:74-82`). A shared "open ticket by id" host in `src/layouts/AppLayout.tsx`, which also loads a ticket that is not in the store, would serve both.

### No "Mark all as read" button

**Severity:** Low · **good first issue**

**What happens.** The notification store has `markAllAsRead`, but the dropdown only offers **Clear all**.

**Where.** `markAllAsRead` in `src/store/useNotificationStore.ts:84`; dropdown header in `src/components/NotificationDropdown.tsx`.

**Suggested approach.** Add a "Mark all as read" button next to **Clear all** when there are unread notifications.

### Portal requesters are not notified

**Severity:** Low · **good first issue**

**What happens.** A request submitted from the Support Portal is not linked to its requester for notifications: status-change and reply notifications go to watchers and to the profile whose email matches `customer_email`, and the portal sets neither. Branch managers therefore hear nothing about their own requests.

**Where.** Insert in `src/components/BranchRequestModal.tsx:37-47`; notification triggers in `supabase/migrations/20260926000000_flowdesk_schema.sql:874-1045`.

**Suggested approach.** After inserting the ticket (with `.select('id')`), add the requester to `ticket_watchers`. Row level security already allows branch managers to add watchers.

### Mentions in the Support Portal do not notify

**Severity:** Low · **good first issue**

**What happens.** An @mention typed in a Support Portal message is saved in the text but sends no notification. Mentions in the ticket panel do.

**Where.** `handleSendComment` in `src/components/CustomerTicketDetail.tsx:95`; the mention logic to reuse is in `src/components/TicketDetailPanel.tsx:279-303`.

**Suggested approach.** Move the mention extraction and notification insert into a shared helper and call it from both places.

---

## Navigation and search

### Command palette and shortcut quirks

**Severity:** Low · **good first issue**

**What happens.**
- **Go to Backlog** navigates to `/`, which is the user's home page (My Work for developers, the Dashboard for branch managers).
- The sidebar shows the hint "Cmd K" on every platform; Ctrl+K works too.

**Where.** `src/components/CommandPalette.tsx:163`; `src/layouts/AppLayout.tsx:186`.

**Suggested approach.** Navigate to `/backlog` (only for roles that have it), and show "Ctrl K" on non-Apple platforms.

### Calendar "Unassigned" filter shows nothing

**Severity:** Low · **good first issue**

**What happens.** Choosing **Unassigned** in the Calendar's Assignee filter hides every ticket, because the filter compares `assigned_to` with the string `'unassigned'`. The same list shows every profile by full name only, so users without a name appear blank.

**Where.** `src/pages/CalendarTimeline.tsx:55` (filter) and `:162-172` (the Assignee list).

**Suggested approach.** Handle `'unassigned'` as the Kanban board does (`src/pages/KanbanBoard.tsx:80-81`) and fall back to the email when there is no name.

---

## Lists and board

### Dead buttons on the Kanban board

**Severity:** Low · **good first issue**

**What happens.** The **+** button in each column header and the **...** button on each card have no click handler.

**Where.** `src/components/KanbanColumn.tsx:39-41`; `src/components/TicketCard.tsx:89-91`.

**Suggested approach.** Make **+** open the new-ticket form preset to that column's status (a new `initialStatus` prop on `NewTicketModal`), and either give **...** a small menu (open, assign to me, copy link) or remove both.

### Kanban comment count is always 0

**Severity:** Low · **good first issue**

**What happens.** The speech-bubble count on cards reads the legacy `notes` column, which nothing writes, so it always shows 0.

**Where.** `src/components/TicketCard.tsx:155`.

**Suggested approach.** Add `ticket_comments(count)` to the ticket query in `src/store/useTicketStore.ts` and show that, or remove the counter.

### The Kanban board needs horizontal scrolling

**Severity:** Low

**What happens.** The six columns are 320 px wide each, so they do not fit on a 1280 px or 1440 px screen. **On-Hold**, **Approved / Ready to Release** and **Released / Closed** are off to the right, and moving a card from Intake to Released / Closed takes a horizontal scroll between drags.

**Where.** `min-w-[320px] max-w-[320px]` in `src/components/KanbanColumn.tsx:28`.

**Suggested approach.** Let columns shrink to a smaller minimum (for example 240 px) on narrower screens, or make the rarely used columns collapsible.

### Status names and colors differ between screens

**Severity:** Low · **good first issue**

**What happens.** Each screen has its own status map. The same status is called "Approved", "Beta Testing" or "UAT" depending on the page, and the Backlog and My Work have no label or color for Planning, SOW In Progress, Awaiting Customer Approval, In Review and Rejected (the raw value, such as `awaiting_customer_approval`, is shown). The dev-task list in the ticket panel shows raw values for statuses without a Kanban column, including the four on-hold statuses. (The Support Portal has a label for every status.)

**Where.** `src/pages/Backlog.tsx:17-27`, `src/pages/MyWork.tsx:18-28`, `src/pages/Portal.tsx:32-47`, `src/components/MobileTaskCard.tsx:23-40`, `src/pages/Admin.tsx:82-86`, `src/components/TicketDetailPanel.tsx:1581` (dev-task status lookup).

**Suggested approach.** Create one status definition (label, short label, color) next to `COLUMNS` in `src/types/index.ts` and use it everywhere. The Support Portal may keep deliberately simpler, customer-friendly names.

### "Assigned to Me" chip count is always 0

**Severity:** Low · **good first issue**

**What happens.** The quick-filter chips show a count badge, except **Assigned to Me**, whose count is hard-coded to 0 (so no badge appears).

**Where.** `src/components/FilterBar.tsx:83`.

**Suggested approach.** Count tickets whose `assigned_to` equals the current profile id, as `useTicketFilters` does at `:34-35`.

### Admin ticket list shows the creator's email as the customer email

**Severity:** Low · **good first issue**

**What happens.** The admin ticket loader replaces each ticket's `customer_email` with the email of the user who created it. **Admin Panel > All Tickets** shows that address under the title, and the CSV export's "Customer Email" column contains it.

**Where.** `src/store/useAdminStore.ts:162`; used in `src/pages/Admin.tsx:504-506` and the CSV export at `:95-123`.

**Suggested approach.** Keep `customer_email` untouched and add a separate `created_by_email` field (with its own CSV column if useful).

---

## Ticket panel

### Branch managers' comments are labelled "Customer"

**Severity:** Low · **good first issue**

**What happens.** The **Unified Ticket Feed** treats only admins, developers and support desk as staff. A branch manager's comment is therefore labelled **Customer**, shown in a white bubble on the right, like a requester's message. Every staff comment shows the same generic "S" avatar instead of the author's initial.

**Where.** `isStaff` in `src/components/TicketDetailPanel.tsx:1949`; the bubble alignment at `:1953`, the avatar at `:1957` and the label at `:1967`.

**Suggested approach.** Label branch managers as "Team" (or "Branch"), keep "Customer" for the `customer` role, and show each author's initial or avatar.

### Cosmetic glitches

**Severity:** Low · **good first issue**

**What happens.**
- The **New Milestone**, **New Release** and **Link** buttons turn into **Cancel** while their form is open, but keep the **+** icon.
- On a 375 px wide screen, the ticket panel's type pill overlaps the export and close icons in the header.

**Where.** `src/pages/MilestonesPage.tsx:130`, `src/pages/ReleasesPage.tsx:101`, `src/components/TicketDetailPanel.tsx:1236`; the panel header in `src/components/TicketDetailPanel.tsx:731-809`.

**Suggested approach.** Show an **X** icon (or no icon) while the button reads **Cancel**. Let the header wrap, or move the type pill below the ticket ID, on narrow screens.

---

## Time tracking

### Billed hours can be overwritten

**Severity:** Low

**What happens.** **Billed Hours** is both a field you can type in (**Edit Timeline**) and a running total. Stopping a timer sets it to the sum of the ticket's time entries, which discards any value typed by hand. **Log Time** adds to the current value and deleting an entry subtracts, so the numbers can drift apart.

**Where.** `stopTimer` in `src/store/useTimerStore.ts:108-120`; `handleLogTime`, `handleDeleteTimeEntry` and `handleEditTimeEntry` in `src/components/TicketDetailPanel.tsx:348-424`.

**Suggested approach.** Derive billed hours from `time_entries` in one place (a database trigger or view) and make the field read-only, or store manual adjustments as their own time entries.

---

## Knowledge Base

### KB search does not use the full-text index

**Severity:** Low · **good first issue**

**What happens.** The `kb_articles` table has a weighted full-text column (`fts`) with a GIN index, but the page filters the loaded articles in the browser with a substring match.

**Where.** `supabase/migrations/20260926000000_flowdesk_schema.sql:412-416` and `:479`; `filteredArticles` in `src/pages/KnowledgeBase.tsx:37`.

**Suggested approach.** Query with `.textSearch('fts', query, { type: 'websearch' })` when the search box is not empty.

### Knowledge Base card previews run text together

**Severity:** Low · **good first issue**

**What happens.** The preview on each article card strips the HTML tags without adding spaces, so a heading runs straight into the next paragraph, for example "checks.Quick checksMake sure".

**Where.** `article.content.replace(/<[^>]*>/g, '')` in `src/pages/KnowledgeBase.tsx:379`.

**Suggested approach.** Replace block-level tags with a space before stripping, or read the text with `DOMParser` and `textContent`, then collapse repeated whitespace.

---

## Support Portal

### Portal request details are missing the description and product

**Severity:** Medium · **good first issue**

**What happens.** The Support Portal loads only some columns per ticket. When a request is opened, the detail view has no **Original Request** text and no product chip. Requests opened from **Your Requests** do show their target dates and hours in the **Delivery Roadmap**, but rows in **All Open Requests** load no dates or hours, so requests opened from that list show an empty roadmap.

**Where.** The `select(...)` calls in `src/pages/Portal.tsx:105-111` (Your Requests) and `:115-121` (All Open Requests); the detail view reads `ticket.description` (Original Request, `src/components/CustomerTicketDetail.tsx:292`), `ticket.product` (product chip, `:213`) and the target date fields.

**Suggested approach.** Select the missing columns (including `description` and `product:products(*)`), or load the full ticket by id inside `CustomerTicketDetail`.

### Portal labels and tracker gaps

**Severity:** Low · **good first issue**

**What happens.**
- The Communication Log labels every message not written by staff as "You", including messages from other branch managers.
- The Delivery Tracker highlights no step for on-hold, SOW In Progress, Awaiting Customer Approval or Rejected tickets.

**Where.** `src/components/CustomerTicketDetail.tsx:410` and `customerSteps` at `:34-39`.

**Suggested approach.** Compare the author's id with the signed-in user; add tracker states such as "On hold" and "Closed without delivery".

---

## Mobile

### Mobile shows a ticket list only

**Severity:** Medium

**What happens.** Below 768 px the app replaces the sidebar and pages with a single ticket list and a bottom bar. The **Tasks** button does nothing, **Products** changes the address but nothing visible changes, the impersonation banner is not shown, and the list depends on the shared ticket store (it can be empty, for example for branch managers). The Kanban board, Backlog, Admin Panel and other pages are unavailable on phones.

Phones also never show the account notices. The "Account Deactivated" and "No Role Assigned" screens are rendered inside the page area, which is hidden below 768 px, so a deactivated user or a user without a role sees an empty ticket list on a phone instead of the explanation.

**Where.** `src/layouts/AppLayout.tsx:101-137` (mobile shell, which always renders `MobileDashboard`) and `:286` (`hidden md:flex` on the main area); `src/components/MobileDashboard.tsx`; the account notices in `RequireRole`, `src/App.tsx:52-68`.

**Suggested approach.** Turn the sidebar into a drawer on small screens and make the main pages responsive one at a time, starting with My Work and the Support Portal. Check the account state before choosing the mobile or desktop layout, so the notices show on every screen size.

---

## Calendar

### Timeline view depends on a FullCalendar Premium plugin

**Severity:** Low

**What happens.** The Calendar's **Timeline** view uses `@fullcalendar/resource-timeline`, a FullCalendar Premium plugin that is licensed separately from FlowDesk's MIT license (see [fullcalendar.io/license](https://fullcalendar.io/license)). Without `VITE_FULLCALENDAR_LICENSE_KEY`, FullCalendar shows its license warning on that view. The month and week calendar use only free plugins.

**Where.** `package.json` dependencies; `src/pages/CalendarTimeline.tsx:30-33` and `:239-259`.

**Suggested approach.** Replace the Timeline with an assignee view built on the free plugins (or another MIT-licensed library), or make it opt-in behind the license key.

---

## Code health and tooling

### Large JavaScript bundle

**Severity:** Medium · **good first issue**

**What happens.** A production build produces one main JavaScript chunk of about 2.3 MB (minified, before compression), and Vite warns about the chunk size. Every visitor downloads all pages, charts, the calendar and the editor up front. (The PDF library is already loaded on demand, as a separate chunk of about 1 MB.)

**Where.** `src/App.tsx:1-18` imports every page directly; `vite.config.ts` has no chunking configuration.

**Suggested approach.** Load pages with `React.lazy` and `Suspense` in `src/App.tsx`, then consider `build.rollupOptions.output.manualChunks` for large libraries (recharts, FullCalendar, TipTap). Compare `npm run build` output before and after in the pull request.

### No automated tests

**Severity:** Medium · **good first issue** (for the first unit tests)

**What happens.** There is no test runner and no test script; `npm run build` type-checks and bundles only.

**Suggested approach.**
- Start with [Vitest](https://vitest.dev/) for pure logic: `parseTimeToHours` and `formatHoursToTime` in `src/utils/timeTracker.ts`, `canTransition` in `src/store/useApprovalStore.ts`, `useTicketFilters` in `src/components/FilterBar.tsx`, and the time math in `src/components/SlaBadge.tsx`.
- Test row level security and triggers against a local Supabase stack (`supabase test db` with pgTAP).
- Add a few end-to-end tests (for example Playwright) for sign-in, the forced password change, creating a ticket and moving it on the board.
- Add a `test` script and run it, with `npm run lint`, in continuous integration.

### About 93 ESLint errors

**Severity:** Low · **good first issue**

**What happens.** `npm run lint` currently reports 93 errors and 15 warnings:

| Rule | Count |
|---|---|
| `@typescript-eslint/no-explicit-any` (error) | 91 |
| `@typescript-eslint/no-unused-vars` (error) | 2 |
| `react-hooks/exhaustive-deps` (warning) | 14 |
| `react-refresh/only-export-components` (warning) | 1 |

The build does not run ESLint, so it still passes.

**Suggested approach.** Fix them file by file in small pull requests, replacing `any` with the types in `src/types/index.ts` or `unknown` plus narrowing. Once the count is zero, run lint in continuous integration.

### Browser alert() dialogs for errors

**Severity:** Low · **good first issue**

**What happens.** Several errors, including sign-in failures, are shown with the browser's `alert()` dialog instead of the app's toasts or inline messages.

**Where.** `src/pages/Login.tsx:27` and `:34`, `src/components/NewTicketModal.tsx:111` and `:118`, `src/components/EditProfileModal.tsx:63` and `:94`, `src/components/EditUserModal.tsx:49`, `src/components/RichTextEditor.tsx:56`, `src/components/TicketDetailPanel.tsx:649`, `src/components/CustomerTicketDetail.tsx:191`.

**Suggested approach.** Use `toast.error(...)` from `react-hot-toast` (already mounted in `src/main.tsx`), or an inline error like the one in `src/components/NewUserModal.tsx`.

### React Router future-flag warnings in the console

**Severity:** Low · **good first issue**

**What happens.** Every page load logs two React Router warnings in the browser console, about the v7 future flags `v7_startTransition` and `v7_relativeSplatPath`. They are harmless, but they hide real errors when someone is debugging.

**Where.** `<BrowserRouter>` in `src/App.tsx:127` sets no future flags.

**Suggested approach.** Use `<BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>`, then check that navigation and the nested routes still behave the same.

### Local Supabase stack on Windows: a log container keeps restarting

**Severity:** Low

**What happens.** With Docker Desktop on Windows, `npx supabase start` works, but the `supabase_vector_flowdesk` container restarts in a loop because it cannot reach the Docker daemon over TCP ("Network unreachable"), and `npx supabase status` lists it as stopped. The app, database, Auth, API and Edge Functions are not affected; only the log explorer in the local Studio stays empty.

**Where.** `supabase/config.toml` has no `[analytics]` section, so the CLI's defaults apply.

**Suggested approach.** Workarounds: turn on **Expose daemon on tcp://localhost:2375 without TLS** in Docker Desktop's settings, or add the following to `supabase/config.toml` (local only) and restart the stack:

```toml
[analytics]
enabled = false
```

Also listed in [SETUP.md](SETUP.md#optional-run-supabase-locally-with-docker).
