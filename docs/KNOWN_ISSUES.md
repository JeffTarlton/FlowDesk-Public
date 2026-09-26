# Known Issues and Limitations

This is an honest list of what does not work yet, or works differently from what the UI suggests. It is written for contributors: every entry says what happens, where the code lives, and a suggested approach. Entries marked **good first issue** are small and self-contained.

Before you start on one, check the [issue tracker](https://github.com/OWNER/flowdesk/issues) and comment there so nobody duplicates the work. [CONTRIBUTING.md](../CONTRIBUTING.md) explains the development setup and pull request process, and [ARCHITECTURE.md](ARCHITECTURE.md) explains how the code is organised. **Report security vulnerabilities privately** as described in [SECURITY.md](../SECURITY.md), not in a public issue.

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
| Workflow | [Kanban drags skip approval gates](#kanban-drags-skip-approval-gates) | High | Yes |
| Workflow | [Approval gates are enforced in the browser only](#approval-gates-are-enforced-in-the-browser-only) | Medium | |
| Workflow | [Five statuses have no Kanban column](#five-statuses-have-no-kanban-column) | Medium | |
| Workflow | [Edits the database refuses can look successful](#edits-the-database-refuses-can-look-successful) | Medium | |
| Workflow | [Customer-approval auto-move does not notify watchers](#customer-approval-auto-move-does-not-notify-watchers) | Low | |
| Workflow | [Status changes from the ticket panel are not logged](#status-changes-from-the-ticket-panel-are-not-logged) | Low | Yes |
| Workflow | [Activity log shows literal asterisks](#activity-log-shows-literal-asterisks) | Low | Yes |
| Workflow | [Admin "All Tickets" table shortcuts](#admin-all-tickets-table-shortcuts) | Low | Yes |
| Workflow | [Branch managers' Kanban tickets get no branch](#branch-managers-kanban-tickets-get-no-branch) | Low | Yes |
| Dates | [Dates can show one day early west of UTC](#dates-can-show-one-day-early-west-of-utc) | Medium | |
| SLA | [SLA breach notifications are not implemented](#sla-breach-notifications-are-not-implemented) | Medium | |
| SLA | [The SLA Resolution KPI always shows 0](#the-sla-resolution-kpi-always-shows-0) | Low | Yes |
| SLA | [Some "SLA" labels are not based on SLA data](#some-sla-labels-are-not-based-on-sla-data) | Low | Yes |
| SLA | [Editing an SLA policy does not update open tickets](#editing-an-sla-policy-does-not-update-open-tickets) | Low | |
| Security and admin | [Impersonation changes menus only](#impersonation-changes-menus-only) | Medium | |
| Security and admin | [Files embedded in text use public links](#files-embedded-in-text-use-public-links) | Medium | |
| Security and admin | [admin-actions returns HTTP 200 for errors](#admin-actions-returns-http-200-for-errors) | Low | |
| Security and admin | [Invite User silently recovers existing accounts](#invite-user-silently-recovers-existing-accounts) | Low | |
| Security and admin | [Force Password Reset has weak checks](#force-password-reset-has-weak-checks) | Low | Yes |
| Security and admin | [The customer role has no user interface](#the-customer-role-has-no-user-interface) | Low | |
| Notifications | [Clicking a notification does not open the ticket](#clicking-a-notification-does-not-open-the-ticket) | Low | Yes |
| Notifications | [No "Mark all as read" button](#no-mark-all-as-read-button) | Low | Yes |
| Notifications | [Portal requesters are not notified](#portal-requesters-are-not-notified) | Low | Yes |
| Notifications | [Mentions in the Support Portal do not notify](#mentions-in-the-support-portal-do-not-notify) | Low | Yes |
| Navigation | [Selecting a ticket in the command palette does not open it](#selecting-a-ticket-in-the-command-palette-does-not-open-it) | Medium | Yes |
| Navigation | [Command palette and shortcut quirks](#command-palette-and-shortcut-quirks) | Low | Yes |
| Navigation | [Calendar "Unassigned" filter shows nothing](#calendar-unassigned-filter-shows-nothing) | Low | Yes |
| Lists and board | [Dead buttons on the Kanban board](#dead-buttons-on-the-kanban-board) | Low | Yes |
| Lists and board | [Kanban comment count is always 0](#kanban-comment-count-is-always-0) | Low | Yes |
| Lists and board | [Status names and colors differ between screens](#status-names-and-colors-differ-between-screens) | Low | Yes |
| Lists and board | ["Assigned to Me" chip count is always 0](#assigned-to-me-chip-count-is-always-0) | Low | Yes |
| Lists and board | [Admin ticket list shows the creator's email as the customer email](#admin-ticket-list-shows-the-creators-email-as-the-customer-email) | Low | Yes |
| Time tracking | [Billed hours can be overwritten](#billed-hours-can-be-overwritten) | Low | |
| Knowledge Base | [KB view count does not increase for non-staff](#kb-view-count-does-not-increase-for-non-staff) | Low | Yes |
| Knowledge Base | [KB search does not use the full-text index](#kb-search-does-not-use-the-full-text-index) | Low | Yes |
| Support Portal | [Portal request details are missing the description, product and dates](#portal-request-details-are-missing-the-description-product-and-dates) | Medium | Yes |
| Support Portal | [Portal labels and tracker gaps](#portal-labels-and-tracker-gaps) | Low | Yes |
| Mobile | [Mobile shows a ticket list only](#mobile-shows-a-ticket-list-only) | Medium | |
| Calendar | [Timeline view depends on a FullCalendar Premium plugin](#timeline-view-depends-on-a-fullcalendar-premium-plugin) | Low | |
| Code health | [Large JavaScript bundle](#large-javascript-bundle) | Medium | Yes |
| Code health | [No automated tests](#no-automated-tests) | Medium | Yes |
| Code health | [About 93 ESLint errors](#about-93-eslint-errors) | Low | Yes |
| Code health | [Browser alert() dialogs for errors](#browser-alert-dialogs-for-errors) | Low | Yes |

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

**Where.** `src/pages/Dashboard.tsx:22`, `src/pages/CalendarTimeline.tsx:36`, `src/pages/MilestonesPage.tsx:17`, `src/pages/ReleasesPage.tsx:18`, `src/components/CommandPalette.tsx:34`, `src/components/MobileDashboard.tsx:12`; branches in `src/components/NewTicketModal.tsx:26` and `src/components/TicketDetailPanel.tsx:99`. The recovery path is `src/hooks/useSessionRecovery.ts:25`.

**Suggested approach.** Add a small `useEnsureTickets()` hook that calls `fetchTickets()` when the store is empty, and use it on those pages. Call `fetchBranches()` when the branch list is empty in the two ticket components.

---

## Workflow and approvals

### Kanban drags skip approval gates

**Severity:** High · **good first issue**

**What happens.** Approval gates are never enforced when a card is dragged on the Kanban board. For example, with the default gate "Ready for Dev to In Progress needs admin approval", a card without admin approval can be dragged to In Progress and the change is saved. The same change through the ticket panel's **Status** dropdown is correctly refused. (Verified in a browser against the current code.)

**Why.** `handleDragOver` moves the card optimistically and also rewrites `activeTicket.status` to the target column. dnd-kit calls `onDragEnd` from the latest props, so `handleDragEnd` checks `canTransition(activeTicket, newStatus)` with a ticket that is *already* in the target status, and finds no gate from "In Progress" to "In Progress". The store's own check in `updateTicketStatus` has the same problem, because it reads the optimistically moved ticket.

**Where.** `src/pages/KanbanBoard.tsx:121-131` (optimistic move in `handleDragOver`) and `:177-187` (gate check in `handleDragEnd`); `src/store/useTicketStore.ts:99-107`.

**Suggested approach.** Check the gate against the status captured at drag start: `canTransition({ ...activeTicket, status: originalStatus }, newStatus)`. Let `updateTicketStatus` accept the original status (or check before `moveTicketOptimistically`). Keep the existing `fetchTickets()` call to undo the optimistic move when a gate blocks. The acceptance-criteria rule for **Released / Closed** is not affected.

### Approval gates are enforced in the browser only

**Severity:** Medium

**What happens.** Apart from "only an admin may grant admin approval", the database does not know about gates. A status change made through **Admin Panel > All Tickets**, or directly through the API by any user who may edit the ticket, skips gates and the "Acceptance Criteria required before closing" rule. The Admin dropdown also writes no activity log entry. This is also listed under "Known design limits" in [SECURITY.md](../SECURITY.md).

**Where.** Client checks: `canTransition` in `src/store/useApprovalStore.ts:97`, used by `src/components/TicketDetailPanel.tsx:426-447`. Bypass: `updateTicketStatus` in `src/store/useAdminStore.ts:231` (called from `src/pages/Admin.tsx:524-538`). The only server rule: `guard_ticket_privileged_columns` in `supabase/migrations/20260926000000_flowdesk_schema.sql:725-753`.

**Suggested approach.** Add a `BEFORE UPDATE` trigger on `public.tickets` that, when `status` changes and `current_user` is `authenticated`, looks up an active row in `approval_gates` for `(OLD.status, NEW.status)` and raises an error if the approvals are missing, and rejects `done` without acceptance criteria. Follow the pattern of the existing guard triggers so trusted paths (SQL editor, service role) still work. Put it in a new timestamped migration, and make the UI show the database's error message.

### Five statuses have no Kanban column

**Severity:** Medium

**What happens.** **Planning**, **SOW In Progress**, **Awaiting Customer Approval**, **In Review** and **Rejected** can be set from the ticket panel, but the board has no column for them, so those tickets vanish from the board. They still appear in the Backlog and My Work.

**Where.** `COLUMNS` in `src/types/index.ts:162-169`; the column filter in `src/pages/KanbanBoard.tsx:77`.

**Suggested approach.** Decide on a mapping and document it. One option: map Planning, SOW In Progress and Awaiting Customer Approval into the Intake column (with a status chip on the card, as on-hold tickets have), map In Review into In Progress, and add a collapsible "Rejected" column. Grouped columns need a way to choose the exact status on drop, like the On-Hold dialog in `src/components/OnHoldModal.tsx`.

### Edits the database refuses can look successful

**Severity:** Medium

**What happens.** Ticket edits are applied to the screen first (optimistic updates). When row level security filters a row out, PostgREST returns success with zero rows changed, not an error, so the change stays on screen until the next reload. Examples: a branch manager editing or deleting a ticket that is not from their branch, or deleting any ticket. The ticket panel also shows controls that some roles cannot use: **Delete** and **Link** for branch managers, and the **New Release** button for support desk (that one does show an error).

**Where.** `updateTicketFields` and `deleteTicket` in `src/store/useTicketStore.ts:131-167`; the controls in `src/components/TicketDetailPanel.tsx` (footer **Delete**, **Link** in Linked Tickets).

**Suggested approach.** Add `.select('id')` to updates and deletes and treat an empty result as "not permitted": roll back and show a toast. Hide controls the current role cannot use (see the roles table in [GETTING_STARTED.md](GETTING_STARTED.md#5-roles-and-permissions)).

### Customer-approval auto-move does not notify watchers

**Severity:** Low

**What happens.** Approving the customer side of a ticket in **Awaiting Customer Approval** moves it to **Ready for Dev** (a database trigger). Watchers and the customer get no "status changed" notification for that move, and no activity log entry is written for it.

**Why.** `on_ticket_status_change` is declared `AFTER UPDATE OF status`. PostgreSQL fires column-specific triggers only when the `UPDATE` statement's `SET` list names the column. The client only sets `customer_approved`; the status is changed by the `BEFORE` trigger `ticket_auto_ready_for_dev`, which does not count.

**Where.** `supabase/migrations/20260926000000_flowdesk_schema.sql`: `handle_customer_approval_trigger` at `:758-771`, trigger at `:1181-1184`, `on_ticket_status_change` at `:1202-1205`. Client: `approveTicket` in `src/store/useTicketStore.ts:268`.

**Suggested approach.** In a new migration, recreate the trigger as `AFTER UPDATE ON public.tickets FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)`. Consider the same change for `on_ticket_assignment`.

### Status changes from the ticket panel are not logged

**Severity:** Low · **good first issue**

**What happens.** Moving a ticket on the Kanban board writes "Moved request to ..." to its activity log. Changing the **Status** dropdown in the ticket panel writes nothing, so the history is incomplete.

**Where.** `handleStatusChange` in `src/components/TicketDetailPanel.tsx:426` calls `updateTicketFields`, which only logs assignment changes (`src/store/useTicketStore.ts:143-167`). Kanban uses `updateTicketStatus` (`:95-129`).

**Suggested approach.** Quick fix: call `updateTicketStatus` from the panel. Better: write status-change log rows in a database trigger, which also covers the Admin dropdown and API clients.

### Activity log shows literal asterisks

**Severity:** Low · **good first issue**

**What happens.** Entries such as "Moved request to \*\*Ready for dev\*\*" and "Linked ticket as \*\*Blocks\*\*" show the asterisks, because the feed renders HTML, not Markdown.

**Where.** `src/store/useTicketStore.ts:121`, `src/store/useRelationshipStore.ts:80`; rendered in `src/components/TicketDetailPanel.tsx:1924`.

**Suggested approach.** Use `<strong>...</strong>`, as the approval entries already do (`src/store/useTicketStore.ts:284`).

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

---

## Dates

### Dates can show one day early west of UTC

**Severity:** Medium

**What happens.** For users in time zones behind UTC (for example the Americas), dates can be displayed one day early:

- Ticket **Target Start**, **Target Test** and **Due Date** are saved as `yyyy-MM-dd` into `timestamptz` columns, so they are stored as midnight UTC, and then shown with `new Date(...)` in local time: 15 October becomes 14 October. Opening **Edit Timeline** and saving without changes can then store the earlier date. The Calendar and Support Portal are affected the same way.
- Milestone target dates and release dates are `date` columns, but they are displayed with `new Date('YYYY-MM-DD').toLocaleDateString()`, which parses the value as UTC. For example, in `America/Chicago` `new Date('2026-10-15').toLocaleDateString()` gives `10/14/2026`. The **Overdue** checks use the same parsing.

**Where.** `src/components/TicketDetailPanel.tsx:176-178` and `:644-646`; `src/pages/CalendarTimeline.tsx:76-77`; `src/pages/MilestonesPage.tsx:231` and `:281`; `src/pages/ReleasesPage.tsx:253`; similar parsing in `src/pages/ExecutiveDashboard.tsx` and `src/pages/ReportsPage.tsx`.

**Suggested approach.** Treat date-only values as local calendar dates: parse them with `date-fns` `parseISO` (which reads `YYYY-MM-DD` as local midnight) and never round-trip them through UTC. Consider migrating the three ticket date columns to `date`. Add a unit test that runs with `TZ=America/Chicago`.

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

**Where.** `getPublicUrl` in `src/components/RichTextEditor.tsx:41`; bucket definitions in `supabase/migrations/20260926000000_flowdesk_schema.sql:1754-1761`.

**Suggested approach.** Make `ticket_attachments` private, store the storage path in the HTML (for example a `data-path` attribute), and replace it with a signed URL when the content is rendered. Avatars can stay public.

### admin-actions returns HTTP 200 for errors

**Severity:** Low (intentional for now)

**What happens.** The `admin-actions` Edge Function always answers HTTP 200 and puts failures in `{ error: "..." }`. This keeps error messages visible in the UI, because the call sites read `data.error`, but it hides failures from HTTP monitoring and from anyone calling the function directly. The intended status (400, 401, 403, 404, 409 or 500) is only written to the function logs.

**Where.** `supabase/functions/admin-actions/index.ts:24-27`, `jsonResponse` at `:59-64`, catch block at `:325-331`. Call sites: `src/components/NewUserModal.tsx:81-82`, `src/components/ForcePasswordResetModal.tsx:220-221`, `src/components/TicketDetailPanel.tsx:237-241`, and the direct `fetch` in `forcePasswordReset` (`src/store/useAdminStore.ts:250`). Error mapping: `src/lib/edgeFunctionError.ts`.

**Suggested approach.** In supabase-js, a non-2xx response arrives as a `FunctionsHttpError` whose `context` is the `Response`, so the body can still be read with `await error.context.json()`. Add a helper that does this, switch all four call sites and `describeAdminActionsError` to it, and only then return real status codes from the function. Ship both halves in one pull request.

### Invite User silently recovers existing accounts

**Severity:** Low

**What happens.** If the email in **Invite User** already belongs to an Auth account without an active profile (a deactivated user, or someone added in the Supabase dashboard), the function takes that account over: it sets the new temporary password, role and branch, and reactivates it. That is usually what an admin wants, but the UI says "User Created!" with no hint that an old account, with its history, was reused. To find the account, the function pages through all Auth users 1000 at a time, which gets slow with many users.

**Where.** `create-user` in `supabase/functions/admin-actions/index.ts:169-240`; `findAuthUserByEmail` at `:98-110`; success screen in `src/components/NewUserModal.tsx:95-154`.

**Suggested approach.** Return a `recovered: true` flag and show "An existing account was reactivated" in the modal. Look the user up by email with a service-role-only SQL function over `auth.users` instead of paging through `listUsers`.

### Force Password Reset has weak checks

**Severity:** Low · **good first issue**

**What happens.**
- The admin types the temporary password in a plain text field; only a 6-character minimum is checked, and the server does not validate it at all.
- Clicking the orange key of a user with a pending reset cancels the reset immediately, with no confirmation and without changing the password.

**Where.** `src/pages/Admin.tsx:403-411` (key button) and `:1357-1362` (length check); `admin-force-password-reset` in `supabase/functions/admin-actions/index.ts:271-295`.

**Suggested approach.** Reuse `generateTempPassword()` from `src/components/NewUserModal.tsx` and show the password once, as Invite User does. Validate length and character classes on the server. Ask for confirmation before cancelling a pending reset.

### The customer role has no user interface

**Severity:** Low

**What happens.** The database has a fifth role, `customer`, with policies that let a customer see and comment on tickets whose `customer_email` matches their profile email. The app has no screens for it: a customer sees "No Role Assigned", and the role pickers do not offer it. It is also the placeholder role given to any account not created through **Invite User**.

**Where.** Enum in `supabase/migrations/20260926000000_flowdesk_schema.sql:58-60`; `handle_new_user` at `:556-576`; customer ticket policy at `:1441-1447`. Frontend: `APP_ROLES` in `src/App.tsx:25` and the check at `:63`; `UserRole` in `src/types/index.ts:1`.

**Suggested approach.** Either build a customer portal (a route guarded for `customer` that reuses `src/components/CustomerTicketDetail.tsx` and lists tickets by `customer_email`, plus the role in the pickers and `create-user`), or remove the role in a migration and use a neutral placeholder.

---

## Notifications

### Clicking a notification does not open the ticket

**Severity:** Low · **good first issue**

**What happens.** Clicking a notification only marks it as read, even though each notification stores its `ticket_id`.

**Where.** `src/components/NotificationDropdown.tsx:104-107` (there is a "Future:" comment).

**Suggested approach.** Build one "open ticket by id" mechanism and use it here and in the command palette (see [below](#selecting-a-ticket-in-the-command-palette-does-not-open-it)).

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

**Where.** `handleSendComment` in `src/components/CustomerTicketDetail.tsx:95`; the mention logic to reuse is in `src/components/TicketDetailPanel.tsx:265-289`.

**Suggested approach.** Move the mention extraction and notification insert into a shared helper and call it from both places.

---

## Navigation and search

### Selecting a ticket in the command palette does not open it

**Severity:** Medium · **good first issue**

**What happens.** Choosing a ticket in the **Ctrl+K** palette navigates to `/?ticket=<id>`. Nothing reads the `ticket` parameter, and `/` immediately redirects to the user's home page, so the ticket never opens.

**Where.** `src/components/CommandPalette.tsx:123`; the redirect in `DefaultLanding`, `src/App.tsx:70-82`.

**Suggested approach.** Add a ticket host in `src/layouts/AppLayout.tsx` that watches a `ticket` search parameter on any page and renders `TicketDetailPanel`, loading the ticket by id when it is not in the store. Then navigate to the current path plus `?ticket=<id>`. Notifications can use the same mechanism.

### Command palette and shortcut quirks

**Severity:** Low · **good first issue**

**What happens.**
- **Go to Backlog** navigates to `/`, which is the user's home page (My Work for developers).
- **Go to Customer Portal** is offered to admins, who are not allowed on `/portal` and are bounced back.
- The sidebar shows the hint "Cmd K" on every platform; Ctrl+K works too.

**Where.** `src/components/CommandPalette.tsx:153` and `:179`; `src/App.tsx:168-172`; `src/layouts/AppLayout.tsx:186`.

**Suggested approach.** Navigate to `/backlog` (only for roles that have it), hide the portal item for admins, and show "Ctrl K" on non-Apple platforms.

### Calendar "Unassigned" filter shows nothing

**Severity:** Low · **good first issue**

**What happens.** Choosing **Unassigned** in the Calendar's Assignee filter hides every ticket, because the filter compares `assigned_to` with the string `'unassigned'`. The same list shows every profile by full name only, so users without a name appear blank.

**Where.** `src/pages/CalendarTimeline.tsx:55` and `:160-162`.

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

### Status names and colors differ between screens

**Severity:** Low · **good first issue**

**What happens.** Each screen has its own status map. The same status is called "Approved", "Beta Testing" or "UAT" depending on the page, and the Backlog and My Work have no label or color for Planning, SOW In Progress, Awaiting Customer Approval, In Review and Rejected (the raw value is shown). The dev-task list in the ticket panel shows raw values for statuses without a Kanban column.

**Where.** `src/pages/Backlog.tsx:17-27`, `src/pages/MyWork.tsx:18-28`, `src/pages/Portal.tsx:29-37`, `src/components/MobileTaskCard.tsx:23-40`, `src/pages/Admin.tsx:82-86`, `src/components/TicketDetailPanel.tsx:1567`.

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

## Time tracking

### Billed hours can be overwritten

**Severity:** Low

**What happens.** **Billed Hours** is both a field you can type in (**Edit Timeline**) and a running total. Stopping a timer sets it to the sum of the ticket's time entries, which discards any value typed by hand. **Log Time** adds to the current value and deleting an entry subtracts, so the numbers can drift apart.

**Where.** `stopTimer` in `src/store/useTimerStore.ts:108-120`; `handleLogTime`, `handleDeleteTimeEntry` and `handleEditTimeEntry` in `src/components/TicketDetailPanel.tsx:334-410`.

**Suggested approach.** Derive billed hours from `time_entries` in one place (a database trigger or view) and make the field read-only, or store manual adjustments as their own time entries.

---

## Knowledge Base

### KB view count does not increase for non-staff

**Severity:** Low · **good first issue**

**What happens.** Opening an article updates `view_count` directly. Row level security only lets admins, developers and support desk update articles, so views by branch managers are silently refused (the count only rises on their screen). The read-then-write update can also lose counts when two people open an article at once.

**Where.** `incrementViewCount` in `src/store/useKbStore.ts:127-140`; policy "Staff can manage articles" in `supabase/migrations/20260926000000_flowdesk_schema.sql:1733-1737`.

**Suggested approach.** Add a `SECURITY DEFINER` function such as `increment_kb_view_count(article_id uuid)` that runs `view_count = view_count + 1` for published articles when the caller has a role, grant `EXECUTE` to `authenticated`, and call it with `supabase.rpc`.

### KB search does not use the full-text index

**Severity:** Low · **good first issue**

**What happens.** The `kb_articles` table has a weighted full-text column (`fts`) with a GIN index, but the page filters the loaded articles in the browser with a substring match.

**Where.** `supabase/migrations/20260926000000_flowdesk_schema.sql:412-416` and `:479`; `filteredArticles` in `src/pages/KnowledgeBase.tsx:37`.

**Suggested approach.** Query with `.textSearch('fts', query, { type: 'websearch' })` when the search box is not empty.

---

## Support Portal

### Portal request details are missing the description, product and dates

**Severity:** Medium · **good first issue**

**What happens.** The Support Portal loads only a few columns per ticket. When a request is opened, the detail view has no **Original Request** text, no product chip, and no target dates in the **Delivery Roadmap** (the "All Open Requests" list also lacks hours).

**Where.** The `select(...)` calls in `src/pages/Portal.tsx:87` and `:97`; the detail view reads `ticket.description`, `ticket.product` and the target date fields in `src/components/CustomerTicketDetail.tsx`.

**Suggested approach.** Select the missing columns (including `product:products(*)`), or load the full ticket by id inside `CustomerTicketDetail`.

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

**Where.** `src/layouts/AppLayout.tsx:101-137` (mobile shell) and `:286` (`hidden md:flex` on the main area); `src/components/MobileDashboard.tsx`.

**Suggested approach.** Turn the sidebar into a drawer on small screens and make the main pages responsive one at a time, starting with My Work and the Support Portal.

---

## Calendar

### Timeline view depends on a FullCalendar Premium plugin

**Severity:** Low

**What happens.** The Calendar's **Timeline** view uses `@fullcalendar/resource-timeline`, a FullCalendar Premium plugin that is licensed separately from FlowDesk's MIT license (see [fullcalendar.io/license](https://fullcalendar.io/license)). Without `VITE_FULLCALENDAR_LICENSE_KEY`, FullCalendar shows its license warning on that view. The month and week calendar use only free plugins.

**Where.** `package.json` dependencies; `src/pages/CalendarTimeline.tsx:30-33` and `:229-251`.

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

**Where.** `src/pages/Login.tsx:27` and `:34`, `src/components/NewTicketModal.tsx:111` and `:118`, `src/components/EditProfileModal.tsx:63` and `:94`, `src/components/EditUserModal.tsx:49`, `src/components/RichTextEditor.tsx:56`, `src/components/TicketDetailPanel.tsx:635`, `src/components/CustomerTicketDetail.tsx:191`.

**Suggested approach.** Use `toast.error(...)` from `react-hot-toast` (already mounted in `src/main.tsx`), or an inline error like the one in `src/components/NewUserModal.tsx`.
