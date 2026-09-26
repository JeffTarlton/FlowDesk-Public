# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.x | Yes |
| < 1.0 | No |

Security fixes are released for the latest 1.x version. Please update to the newest release before reporting a problem, and check [CHANGELOG.md](CHANGELOG.md) for security-related changes.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, pull requests or discussions.**

Report them privately through GitHub's private vulnerability reporting:

1. Go to the repository's **Security** tab (GitHub may label it **Security and quality**).
2. Click **Report a vulnerability**. You can also open the form directly: <https://github.com/OWNER/flowdesk/security/advisories/new>
3. Fill in the form and click **Submit report**. Only the maintainers can see it.

Please include as much of the following as you can:

- What is affected: the frontend, the database schema and RLS policies, storage policies, or the `admin-actions` Edge Function.
- The FlowDesk version or commit you tested.
- Steps to reproduce or a proof of concept, and the role of the account you used (admin, developer, support desk, branch manager, or no role).
- The impact, in your own words: what can an attacker read, change or take over?
- A suggested fix, if you have one.

Only test against a FlowDesk installation you own, such as your own free Supabase project. Never test against someone else's deployment or access data that is not yours.

**What to expect.** FlowDesk is maintained by volunteers, so we cannot promise fixed response times, but we aim to acknowledge a report within a week. We will keep you updated while we investigate, agree a disclosure date with you, and publish a GitHub security advisory when a fix is available. We are happy to credit you in the advisory; tell us if you prefer to stay anonymous.

If the **Report a vulnerability** button is missing, private reporting has not been enabled yet. In that case, open a public issue that only asks the maintainers for a private way to contact them. Do not include any details of the vulnerability.

> **For maintainers:** enable private reporting in the repository's **Settings**, under **Security and quality > Advanced Security > Private vulnerability reporting**, by clicking **Enable**.

### Scope

In scope, for example:

- Bypassing Row Level Security, or reading or changing data your role should not reach.
- Privilege escalation, such as a non-admin changing their own role or skipping the forced password reset.
- Weaknesses in the `admin-actions` Edge Function.
- Cross-site scripting through tickets, comments, articles or profile fields.
- Secrets committed to the repository.

Out of scope:

- Problems that require an already leaked secret (service role) key or a compromised admin account.
- The documented behavior of the public attachment and avatar buckets (see [Attachments are public by URL](#6-attachments-are-public-by-url)).
- Vulnerabilities in Supabase, Vercel or GitHub themselves. Please report those to the vendor.
- Findings from automated scanners without a demonstrated impact.

## How FlowDesk is secured

FlowDesk has no server of its own: the browser talks to Supabase with a **public** key, so access control is enforced inside Postgres with Row Level Security (RLS). In short:

- Signed-out visitors (the `anon` role) have no access to any table.
- Every table has RLS enabled, and the policies check the caller's role through `SECURITY DEFINER` helper functions that return nothing for deactivated accounts.
- Triggers stop non-admins from changing privileged profile columns (role, active status, password reset flag, branch, email) and from granting admin approval on tickets.
- Operations that need the secret key (creating users, changing passwords, deleting comments) run in the `admin-actions` Edge Function, which verifies the caller's token, active profile and role first.

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#6-security-model) describes the full security model.

## Deployment hardening checklist

Work through this list for every FlowDesk installation that is reachable from the internet.

### 1. Change the default admin password

The seeded admin account (`admin@flowdesk.com` / `Password2026!`) is published with the source code. FlowDesk forces a password change at the first sign-in: a **Set Your Password** screen blocks the app until the password is changed, and the new password cannot be the default one.

- Deploy the `admin-actions` Edge Function **before** the first sign-in. The Set Your Password screen needs it; see [docs/SETUP.md](docs/SETUP.md).
- Sign in and set a strong, unique password as soon as the project is online.
- Optional but recommended: invite a personal admin account (Admin > Users > Invite User, role `admin`), sign in with it, and then deactivate or permanently delete `admin@flowdesk.com`, whose email address is public.

### 2. Turn off public sign-ups

FlowDesk has no sign-up screen: admins create users in **Admin > Users > Invite User**. The Supabase Auth API is still public, though, and your project URL and public key are visible in the browser bundle, so anyone could create an account through the API while sign-ups are enabled.

In the Supabase dashboard, open **Authentication**, go to **Sign In / Providers**, and turn off **Allow new users to sign up**. Users created from the Admin panel are not affected.

Even with sign-ups left on, a self-registered account starts deactivated, with the `customer` role (which has no screens in the app), and cannot read any shared data until an admin activates it. Turning sign-ups off keeps such accounts out of your user list entirely. The local stack (`supabase/config.toml`) already has sign-ups disabled.

### 3. Never expose the secret key

Supabase projects have two kinds of keys:

| Key | Where it belongs |
|---|---|
| Publishable key (`sb_publishable_...`) or legacy `anon` key | The frontend (`VITE_SUPABASE_ANON_KEY`). It is public by design; RLS protects the data. |
| Secret key (`sb_secret_...`) or legacy `service_role` key | Nowhere in FlowDesk's configuration. It bypasses RLS completely. The `admin-actions` function receives it from Supabase automatically. |

- Never put a secret key in `.env.local`, in Vercel environment variables, in the repository, in an issue or in a screenshot.
- Every variable whose name starts with `VITE_` or `NEXT_PUBLIC_` is embedded in the JavaScript that every visitor downloads. Never give a secret one of these prefixes.
- If you connected Supabase through the Vercel integration, it may add server-side key variables to your Vercel project. FlowDesk does not use them, and Vite does not embed variables without the prefixes above, but you can remove them to be safe.

### 4. Keep Row Level Security enabled

- Never disable RLS on a FlowDesk table, and do not add broad policies (for example `USING (true)`) by hand. Re-running the base schema file replaces any hand-made policy on the FlowDesk tables with the official set.
- Any table you add needs RLS enabled, explicit grants and policies. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#9-changing-the-schema).
- Review the findings of the **Security Advisor** in the Supabase dashboard from time to time.

### 5. Review the Auth URL configuration

In the Supabase dashboard, open **Authentication** and then **URL Configuration**:

- Set **Site URL** to your production address, for example `https://your-app.vercel.app`. The default, `http://localhost:3000`, is wrong for a deployed app.
- Under **Redirect URLs**, allow only the addresses you use: `http://localhost:5173/**` for local development and, if you use Vercel preview deployments, a pattern such as `https://*-<team-or-account-slug>.vercel.app/**`. Remove entries you no longer need.

FlowDesk itself sends no authentication emails, but any email Supabase sends for your project (for example a password recovery started from the dashboard) links to these addresses.

### 6. Attachments are public by URL

Both storage buckets, `ticket_attachments` and `avatars`, are **public buckets**. The app needs this because it stores plain file URLs in ticket descriptions, comments, knowledge base articles and profile pictures.

What this means in practice:

- **Anyone who has a file's exact URL can download it without signing in.** This includes images and files inside internal notes and draft articles.
- The URLs contain a user id, a timestamp and a random part, so they cannot be guessed, and nobody can list the files in a bucket without being signed in. But a URL is not a secret: it can be forwarded, saved in browser history or logs, or copied by any user who can see the ticket.
- A URL keeps working after the person who copied it loses access to FlowDesk (for example after their account is deactivated). Access to a file ends only when the file is deleted.
- Files in the attachment panel are downloaded through short-lived signed links, but the same file is still reachable through its public URL.

Recommendations:

- Do not upload highly sensitive files, such as passwords, identity documents or payment data, as attachments.
- Delete an attachment to revoke access to it.
- If you need truly private files, the frontend has to switch from public URLs to signed URLs and the buckets have to be made private. That is a code change; contributions are welcome.

### 7. Rotate keys if they leak

- **Secret or `service_role` key leaked:** follow Supabase's rotation procedure. In **Project Settings**, open **API Keys**, create a new secret key, replace the old key wherever you used it, and then delete the leaked secret key (or deactivate the legacy keys if the leaked key was `service_role`). `admin-actions` uses the secret key named `default` and falls back to the legacy `service_role` key. After a rotation, make sure one of them is still available, redeploy the function, and test **Invite User**.
- **Publishable or `anon` key:** this key is public by design, so exposure alone is not an incident. If you replace it anyway, update `VITE_SUPABASE_ANON_KEY` in Vercel and **redeploy**. Vercel applies environment variable changes only to new deployments.
- **A user's password leaked:** an admin can set a temporary password with **Force Password Reset** in Admin > Users. The user must choose a new one at the next sign-in. Deactivate the account first if you suspect misuse.
- Do not commit a new key to fix a leaked one. Keys belong in environment variables and in the Supabase dashboard only.

### 8. Ongoing hygiene

- Deactivate or delete accounts of people who leave. A deactivated account loses access to tickets, comments and all other shared data, because the RLS helper functions return no role for it. It can still see its own profile, which is how the app knows to show "Account Deactivated".
- Keep dependencies up to date and review `npm audit` output.
- Keep the `admin-actions` function in sync with the version in the repository when you upgrade FlowDesk.

## Known design limits

These are deliberate or known limitations, documented so you can judge them for your own deployment. More are listed in [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md).

- **Approval gates are checked in the browser.** The database does not block a status change that skips a gate when it is made directly through the API by a user who is allowed to edit the ticket. Only granting admin approval is enforced by the database.
- **"View as" is a preview.** When an admin views the app as another user, only the menus change; all requests still run with the admin's own permissions.
- **Deactivation does not end a session immediately.** A deactivated user's Auth session stays valid until it expires, but RLS blocks it from tickets and other shared data, and the Edge Function rejects it.
