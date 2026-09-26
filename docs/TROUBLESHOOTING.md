# Troubleshooting FlowDesk

Each entry follows the same pattern: **what you see**, **why it happens**, and **how to fix it**. Messages in quotes are the exact text FlowDesk shows.

Two tools help with almost every problem:

- **The browser console.** Press F12 (or Cmd+Option+I on a Mac) and open the **Console** tab. FlowDesk logs the underlying error there.
- **The Edge Function logs** in Supabase, for anything involving passwords or creating users. See [How to view the Edge Function logs](#how-to-view-the-edge-function-logs).

**Jump to**

| Symptom | Section |
|---|---|
| "FlowDesk isn't configured yet" | [Setup screen](#flowdesk-isnt-configured-yet) |
| A browser alert when signing in | [Signing in](#signing-in) |
| Stuck on "Set Your Password" | [Set Your Password](#stuck-on-set-your-password) |
| "Account Deactivated" or "No Role Assigned" | [Account screens](#account-deactivated) |
| Invite User fails | [Creating users](#creating-a-user-fails) |
| Boards or notifications don't update live | [Realtime](#boards-comments-or-notifications-do-not-update-live) |
| Uploads fail | [Files](#attachments-or-avatars-fail-to-upload) |
| License notice on the Timeline view | [Timeline](#a-license-notice-on-the-calendars-timeline-view) |
| Missing tickets or changes that disappear | [Data looks wrong](#data-looks-wrong-or-incomplete) |
| Build or Vercel problems | [Building and deploying](#building-and-deploying) |
| Errors when running the SQL files | [Database scripts](#sql-errors-when-running-or-re-running-the-scripts) |

---

## Configuration

### "FlowDesk isn't configured yet"

**What you see:** instead of the sign-in page, a card titled "FlowDesk isn't configured yet" lists `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, each marked **set**, **missing** or **not a valid URL**. The console shows "Missing Supabase Environment Variables: Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set (see docs/SETUP.md)."

**Why:** the app was started or built without the Supabase URL or key, or the URL does not start with `https://` (or `http://` for a local stack).

**Fix, when running locally (`npm run dev`):**

1. Make sure a file called exactly `.env.local` exists in the repository root, next to `package.json`. On Windows, check that it is not `.env.local.txt` (turn on file name extensions in File Explorer).
2. Check the contents: `VITE_SUPABASE_URL=https://<project-ref>.supabase.co` and `VITE_SUPABASE_ANON_KEY=<your key>`, with no quotes and no spaces around `=`. See [SETUP.md step 6](SETUP.md#6-copy-your-project-url-and-public-key).
3. **Restart the dev server** (Ctrl+C, then `npm run dev`). Vite reads `.env.local` only when it starts.

**Fix, on Vercel:**

1. Open the project, then **Settings > Environment Variables**, and check both variables exist and apply to the environment you are opening (Production or Preview).
2. **Redeploy** (Deployments > **...** > **Redeploy**). The values are compiled into the site at build time, so a change only takes effect in a new deployment. See [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md#changing-environment-variables-later).

---

## Signing in

FlowDesk shows sign-in errors from Supabase in a browser alert.

### "Invalid login credentials"

| Why | Fix |
|---|---|
| Wrong email or password. | Check for typos. The email is not case sensitive; the password is. |
| The admin seed (`20260926000100_seed_admin.sql`) was never run. | Run it after the schema file ([SETUP.md step 3](SETUP.md#3-create-the-database)). |
| You already changed the default password (for example while running locally: local and Vercel share one database). | Use the password you chose. |
| `admin@flowdesk.com` existed before you ran the seed (for example you added it in the Supabase dashboard). The seed leaves an existing account's password unchanged. | Reset it with the SQL in [Locked out? Reset the admin password](SETUP.md#locked-out-reset-the-admin-password). |

### "Invalid API key" or other key errors

**Why:** `VITE_SUPABASE_ANON_KEY` is not a valid public key for the project in `VITE_SUPABASE_URL`. Common causes: a key from another project, a truncated copy, or the **secret** key (secret keys are refused in browsers).

**Fix:** copy the **publishable** key (`sb_publishable_...`) or the legacy **anon** key again from **Project Settings > API Keys**, update `.env.local` or Vercel, then restart or redeploy. Never use the secret or `service_role` key.

### Sign-in hangs, fails with a network error, or pages stay empty

| Why | Fix |
|---|---|
| **Your free Supabase project is paused.** Free projects are paused after about a week without activity. Requests then time out after 15 seconds. | Open the Supabase dashboard, select the project and click **Resume project**. It keeps all your data. |
| `VITE_SUPABASE_URL` has a typo or points to a deleted project. | Copy the Project URL again ([SETUP.md step 6](SETUP.md#6-copy-your-project-url-and-public-key)). |
| The project's **Data API** is disabled, or the `public` schema is not exposed. | In Supabase, open **Integrations > Data API** (or the Data API settings) and make sure it is enabled for the `public` schema. |

### Sign-in succeeds but you stay on the sign-in page

**Why:** the account exists in Supabase Auth but has no row in FlowDesk's `profiles` table. This happens when a user was created in the Supabase dashboard **before** the schema was run (the trigger that creates profiles did not exist yet).

**Fix:** as an admin, use **Admin > Users > Invite User** with the same email address. FlowDesk creates the missing profile, sets a temporary password and activates the account. For the default admin, simply run the seed file again: it recreates a missing profile.

### Stuck on "Set Your Password"

This full-screen form appears at every new user's first sign-in, including the default admin's. It saves the new password through the `admin-actions` Edge Function, so almost every failure here is about that function. The **Save & Continue** button stays disabled until every rule in the checklist is green.

| Message under the form | Why | Fix |
|---|---|---|
| "The admin-actions Edge Function is not deployed or not reachable. Deploy it (see docs/SETUP.md, "supabase functions deploy admin-actions") and try again." | The function does not exist in this project, has another name, or could not be reached. | Deploy it with the exact name `admin-actions` ([SETUP.md step 4](SETUP.md#4-deploy-the-admin-actions-edge-function)) in the **same** project as `VITE_SUPABASE_URL`. A function deployed under a wrong name cannot be renamed: deploy a new one called `admin-actions`. |
| "Edge Function returned a non-2xx status code" | Supabase's gateway rejected the request before the function ran. Almost always, JWT verification is still on. | See ["Edge Function returned a non-2xx status code"](#edge-function-returned-a-non-2xx-status-code). |
| "Unauthorized" | The function could not verify your sign-in token, for example because the session expired. | Click **Sign out** under the form and sign in again. |
| "Password must be at least 8 characters and include a number and a special character" | The server re-checks the rules. Only the listed special characters count. | Choose a password that meets every rule in the checklist. |
| "Choose a password other than the default setup password" | You entered `Password2026!`. | Pick a different password. |
| "Forbidden: Your account is deactivated" or "Forbidden: No FlowDesk profile for this account" | The account is deactivated, or has no profile. | An admin reactivates the account, or re-creates it with **Invite User**. |
| "Server misconfigured: admin-actions needs SUPABASE_URL and SUPABASE_SECRET_KEYS or SUPABASE_SERVICE_ROLE_KEY" | The function cannot find a usable secret key. This is rare; Supabase provides it automatically. It can happen if the legacy keys are disabled and there is no secret key named `default`. | In **Project Settings > API Keys**, make sure a secret key named `default` exists, or re-enable the legacy keys. Then try again. |
| "Your password was changed, but the reset flag could not be cleared. Please sign in again." | The password was saved but the screen could not confirm it. | Click **Sign out** and sign in with the **new** password. |

If you cannot fix it right away, click **Sign out** under the form. Nothing changes until a new password is saved successfully.

### "Account Deactivated"

**What you see:** "Your FlowDesk account has been suspended or deactivated. Please contact your system administrator for assistance."

**Why:** the account's active flag is off. Either an admin deactivated it, or the account was created outside FlowDesk (with **Add user** in the Supabase dashboard, or through the sign-up API). Such accounts always start deactivated, with the placeholder role `customer`.

**Fix (as an admin):**

- In **Admin > Users**, click **Reactivate User** (the check icon) on the user's row, and pick a role in the **Change Role** column. Or
- Use **Invite User** with the same email address. For an account that is not active, FlowDesk takes it over: it sets a new temporary password, the role and branch you choose, and activates it.

If **no** admin can sign in, use the SQL in [Locked out? Reset the admin password](SETUP.md#locked-out-reset-the-admin-password). To stop strangers creating accounts at all, turn off public sign-ups ([SETUP.md step 5](SETUP.md#5-lock-down-authentication)).

### "No Role Assigned"

**What you see:** "Your FlowDesk account does not have a role yet. Please ask your system administrator to assign one, then sign in again."

**Why:** the account is active but has the placeholder role `customer`, which has no screens in FlowDesk. It usually means the account was created outside FlowDesk and then reactivated without choosing a role.

**Fix:** an admin opens **Admin > Users** and picks **admin**, **developer**, **support desk** or **branch manager** in the **Change Role** column (or with the **Edit** pencil). The user then signs out and in again.

---

## Users and the Edge Function

### Creating a user fails

**Admin > Users > Invite User** calls the `admin-actions` function. Errors appear in red inside the **Create User** form.

| Message | Why | Fix |
|---|---|---|
| "The admin-actions Edge Function is not deployed or not reachable. ..." | The function is missing or misnamed. | Deploy it ([SETUP.md step 4](SETUP.md#4-deploy-the-admin-actions-edge-function)). |
| "Edge Function returned a non-2xx status code" | JWT verification is on. | See [below](#edge-function-returned-a-non-2xx-status-code). |
| "A user with this email already exists" | See the next section. | |
| "Forbidden: Only admins can create users" | The signed-in account is not an admin. (Previewing a role with the eye icon does not change who you are on the server.) | Sign in as an admin. |
| "Missing or invalid field: role" or "Missing or invalid field: email" | The form was sent without a valid role or email. | Choose a role and enter a valid email. |
| A message about the password, such as a minimum length | You raised Supabase's password requirements (in the Email provider settings under **Authentication**). FlowDesk's temporary passwords are 10 characters with upper and lower case letters, a number and a symbol. | Keep the minimum password length at 10 or lower. |

**Admin > Users > Force Password Reset** (the key icon) uses the same function. In that dialog, "Failed to reset password" or a JSON "Unexpected token" error usually means the function is not deployed. "Password must be at least 6 characters" is FlowDesk's own minimum for the temporary password you type.

### "A user with this email already exists"

**Why:** an **active** FlowDesk user already has that email address. FlowDesk never takes over an active account. (It does take over an existing account that is not active, see ["Account Deactivated"](#account-deactivated).)

**Fix:** use a different email address, or manage the existing user instead: use **Force Password Reset** to give them a new temporary password, or change their role on the Users tab.

### "Edge Function returned a non-2xx status code"

**Why:** Supabase's built-in JWT check is switched on for `admin-actions`. That legacy check can reject signed-in users (for example on projects that use the newer JWT signing keys) before FlowDesk's code runs. FlowDesk's function verifies users itself and is meant to run with the check off.

**Fix:** in Supabase, open **Edge Functions > admin-actions > Details** and turn off **Verify JWT with legacy secret**, then **Save changes**. Or redeploy with the CLI:

```bash
npx supabase functions deploy admin-actions --project-ref <project-ref> --no-verify-jwt
```

Quick test: opening `https://<project-ref>.supabase.co/functions/v1/admin-actions` in a browser should show `{"error":"Method not allowed"}`. A 401 message such as "Missing authorization header" means the check is still on.

### How to view the Edge Function logs

1. In the Supabase dashboard, open **Edge Functions** and click **admin-actions**.
2. Open the **Invocations** tab to see each request with its status code and duration, or the **Logs** tab to see messages written by the function.

`admin-actions` logs every failure as `admin-actions error (<status>): <message>`, for example `admin-actions error (403): Forbidden: Only admins can create users`. It always answers the browser with HTTP 200 and puts the error in the response, so the real status is only visible in these logs.

- A request in **Invocations** with no matching line in **Logs** was usually rejected by the JWT check (see above).
- **No requests at all** means the app is calling a different project, or the function is not deployed under the name `admin-actions`.
- On the [local Supabase stack](SETUP.md#optional-run-supabase-locally-with-docker), run `npx supabase functions serve admin-actions` to see the logs in your terminal.

See [Supabase: Edge Function logging](https://supabase.com/docs/guides/functions/logging).

---

## Live updates, files and calendar

### Boards, comments or notifications do not update live

FlowDesk uses Supabase Realtime for the Kanban board, Backlog and My Work lists, the comment feed in tickets, the notification bell, and the "also viewing" avatars.

1. **Refresh the page.** If the data is right after a refresh, only the live connection is the problem. (FlowDesk also re-fetches data when you come back to a tab that was hidden for 2 minutes or more.)
2. **Check the three tables are published.** Run this in the SQL Editor:

   ```sql
   select tablename
   from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public'
   order by tablename;
   ```

   You should see `notifications`, `ticket_comments` and `tickets`. If any are missing, run the schema file again (it adds them), or add them directly:

   ```sql
   alter publication supabase_realtime add table public.tickets;
   alter publication supabase_realtime add table public.notifications;
   alter publication supabase_realtime add table public.ticket_comments;
   ```

   (Each statement fails harmlessly with "already member of publication" if the table is already there.)
3. **Keep public channels allowed.** FlowDesk uses public Realtime channels. In Supabase, open **Realtime > Settings** and make sure **Allow public access** is on. Realtime still applies your Row Level Security rules, so users only receive rows they may see.
4. **Check the network.** Some company proxies and VPNs block WebSocket connections. Try another network.
5. **Is the project paused?** See [Sign-in hangs](#sign-in-hangs-fails-with-a-network-error-or-pages-stay-empty).

### Attachments or avatars fail to upload

| Where | What you see | Why | Fix |
|---|---|---|---|
| Profile picture (Edit Profile) | A browser alert with a storage error | Avatars must be images of **5 MB or less**. | Use a smaller JPG or PNG. |
| Ticket **Attachments** | "Failed to upload: Upload failed: ..." | Files are limited to **50 MB** each (the Free plan maximum). A lower **Global file size limit** in **Storage > Settings** also applies to every bucket. | Use a smaller file, or check the global limit. |
| Files added inside the text editor | "Failed to upload file: ..." | Same limits as attachments. | As above. |
| Any upload | A message containing "row-level security" | The signed-in account is deactivated or has no role. Only active FlowDesk members may upload. | Activate the account and give it a role ([above](#account-deactivated)). |
| Any upload | "Bucket not found" | The storage part of the schema did not run. | Run the schema file again ([SETUP.md step 3](SETUP.md#3-create-the-database)). It creates the `avatars` and `ticket_attachments` buckets. |

**Images or file links inside descriptions, comments or articles are broken:** FlowDesk stores public links to those files, so both buckets must stay **public**. The schema sets this up. If you switched a bucket to private in **Storage**, switch it back (or run the schema file again, which restores the setting). Note what "public" means: anyone who has a file's link can open it. See [SECURITY.md](../SECURITY.md#6-attachments-are-public-by-url).

### A license notice on the Calendar's Timeline view

**What you see:** on **Calendar > Timeline**, FullCalendar shows a notice such as "Your license key is invalid" with a **More Info** link. The month/week **Calendar** view has no notice.

**Why:** the Timeline view uses FullCalendar's premium resource-timeline plugin, which is licensed separately from FlowDesk. Without a key, FullCalendar shows this notice. Everything still works.

**Fix:** either ignore it, or set `VITE_FULLCALENDAR_LICENSE_KEY` to your FullCalendar license key in `.env.local` and/or Vercel, then restart `npm run dev` or redeploy. See [SETUP.md: FullCalendar Timeline license key](SETUP.md#optional-fullcalendar-timeline-license-key). If you already set a key and still see the notice, check it was copied exactly and is valid for the FullCalendar version FlowDesk uses (6.x).

### A Kanban card snaps back after dragging

**Why:** the move was refused. A ticket can only move to **Released / Closed** when it has **Acceptance Criteria**; the message "Cannot move to Done. Acceptance Criteria is required." appears at the top of the screen. Dropping a card on **On-Hold** asks for a reason, and closing that dialog without choosing one also puts the card back.

**Fix:** open the ticket, add the acceptance criteria (or pick an on-hold reason), and try again. Branch managers cannot drag cards at all.

Approval gates (Admin > Gates) are checked when you change the status in the ticket panel. Dragging on the Kanban board currently skips them; see [KNOWN_ISSUES.md](KNOWN_ISSUES.md#kanban-drags-skip-approval-gates).

---

## Data looks wrong or incomplete

These are known limitations of the current version, not setup problems. Details and workarounds are in [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

| What you see | Why | What to do |
|---|---|---|
| The Dashboard, Calendar or another page is empty right after you reload it | A few pages show the ticket list that other pages load, without loading it themselves. | Open the **Backlog** or **Kanban** once, then go back. See [the known issue](KNOWN_ISSUES.md#some-pages-show-the-shared-ticket-list-without-loading-it). |
| An older ticket is missing from Kanban, My Work, the Calendar or a search | Most views work on the 50 most recently created tickets. | Find it in the **Backlog** (use **Load more tickets**) or in **Admin Panel > All Tickets**. See [the known issue](KNOWN_ISSUES.md#most-views-only-load-the-newest-50-tickets). |
| A change looked saved, but it is gone after a reload | The database refused it (the user's role may not edit that ticket), but the screen had already updated. | Check the role's permissions in [GETTING_STARTED.md](GETTING_STARTED.md#5-roles-and-permissions). See [the known issue](KNOWN_ISSUES.md#edits-the-database-refuses-can-look-successful). |

---

## Building and deploying

### The build fails or an old Node.js version is used

**What you see:** `npm install` warns `EBADENGINE Unsupported engine`, or `npm run dev` / `npm run build` fails with errors from inside `node_modules` (syntax errors or missing functions).

**Why:** FlowDesk and its tools need **Node.js 20 or newer** (`"engines": { "node": ">=20" }` in `package.json`). The Supabase CLI (`npx supabase`) also needs Node 20+.

**Fix:**

1. Check your version:

   ```bash
   node -v
   ```

2. If it is below 20, install the current LTS from https://nodejs.org (or with a version manager such as `nvm` / `nvm-windows`).
3. Reinstall the dependencies cleanly:

   ```bash
   rm -rf node_modules
   npm install
   ```

   On Windows PowerShell, use `Remove-Item -Recurse -Force node_modules` instead of `rm -rf node_modules`.

On Vercel, the `engines` range makes Vercel build with its newest Node.js version, so an old Node version is not the cause there. If a Vercel build fails, open the build log: `npm run build` runs `tsc -b` (TypeScript) first, so a type error in changed code stops the build. Run `npm run build` locally to see the same error. Warnings about chunk sizes are normal.

### 404 Not Found when opening or refreshing a page on Vercel

**Why:** Vercel did not apply the single-page-app rewrite in `vercel.json`, so it looks for a file called `/kanban` or `/admin` that does not exist.

**Fix:** make sure `vercel.json` is in the repository root and was pushed, and that the project's **Root Directory** on Vercel is the repository root. See [What vercel.json does](DEPLOY_VERCEL.md#what-verceljson-does).

### Changes to `.env.local` or Vercel variables have no effect

`VITE_` values are read when the dev server starts and compiled in when the site is built. Restart `npm run dev` after editing `.env.local`; redeploy on Vercel after changing a variable ([details](DEPLOY_VERCEL.md#changing-environment-variables-later)).

---

## Database scripts

### SQL errors when running or re-running the scripts

Both files in `supabase/migrations/` are designed to be run again safely: tables are only created when missing, no data is deleted, and triggers, functions and policies are replaced with the current versions. (Any policy you added by hand to a FlowDesk table is removed on a re-run, because the file re-creates the complete set.)

| What you see | Why | Fix |
|---|---|---|
| `relation "public.profiles" does not exist` (or another FlowDesk table) | The seed file ran before the schema file, or the schema run failed part-way. | Run `20260926000000_flowdesk_schema.sql` first, completely, then the seed. |
| A syntax error near the start or end of the script | Only part of the file was pasted, or some text was highlighted when you clicked **Run** (the SQL Editor then runs only the highlighted part). | Select all in the editor, delete, paste the **whole** file again, click somewhere so nothing is highlighted, and run. |
| A warning about destructive operations | The script drops and re-creates its own triggers and policies. | Confirm and run. Your data is not deleted. |
| `permission denied` or `must be owner of ...` | The SQL ran as a restricted role. | Run the files in the Supabase **SQL Editor** (which runs as the project owner) or with `npx supabase db push`. |
| `npx supabase link` fails with a password or authentication error | The database password is wrong. | Reset it on the **Database > Settings** page of the dashboard, then run `link` again. |
| `npx supabase db push` reports remote migration versions that are not in your local migrations folder | The database already has migrations from somewhere else. | Use a fresh project for FlowDesk, or run the two files in the SQL Editor instead. |

If an error mentions a FlowDesk object and none of the above applies, copy the full error message and [open an issue](#still-stuck).

---

## Still stuck?

1. Search the existing issues: https://github.com/JeffTarlton/FlowDesk-Public/issues
2. Check [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for limitations we already know about.
3. Open a new issue with: what you did, what you expected, the exact message, the browser console output, and whether you use hosted or local Supabase and Vercel or `npm run dev`. **Remove any keys, passwords and email addresses before posting.**

Found a security problem? Do not open a public issue; follow [SECURITY.md](../SECURITY.md).
