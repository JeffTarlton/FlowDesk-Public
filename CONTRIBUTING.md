# Contributing to FlowDesk

Thanks for your interest in FlowDesk! Bug reports, fixes, documentation improvements and new features are all welcome, whether this is your first open-source contribution or your hundredth.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

**Found a security problem?** Please do not open a public issue. Follow [SECURITY.md](SECURITY.md) instead.

## Ways to contribute

- **Report a bug.** Open an issue with the bug report template. Steps to reproduce and your setup (browser, hosted or local Supabase, where you deployed) help a lot.
- **Suggest a feature.** Open an issue with the feature request template and describe the problem you want solved, not only the solution.
- **Improve the docs.** Typos, unclear steps and outdated dashboard instructions are easy, valuable fixes. The docs live in the repository root and in [`docs/`](docs/).
- **Fix a known issue.** [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) lists limitations and bugs we already know about. Many of them make good first contributions.
- **Test a release.** Install FlowDesk on a fresh free Supabase project by following [docs/SETUP.md](docs/SETUP.md) and tell us where you got stuck.
- **Review pull requests.** A second pair of eyes, or a quick "I tested this and it works", is always useful.

For anything bigger than a small fix, please open an issue first so we can agree on the approach before you spend time on it.

## Development setup

You need:

- [Node.js](https://nodejs.org/) 20 or newer (the current LTS is a good choice) and npm
- Git
- A Supabase project to develop against. A free hosted project is the easiest option. A local Supabase stack (needs Docker) is optional and is described in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#10-local-development-with-the-supabase-cli).

1. Fork the repository on GitHub, then clone your fork:

   ```bash
   git clone https://github.com/<your-username>/FlowDesk-Public.git
   cd FlowDesk-Public
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your local environment file from the example.

   macOS / Linux:

   ```bash
   cp .env.example .env.local
   ```

   Windows (Command Prompt or PowerShell):

   ```bash
   copy .env.example .env.local
   ```

4. Set up the database, deploy the `admin-actions` Edge Function and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`. [docs/SETUP.md](docs/SETUP.md) walks through every step.

5. Start the dev server and open <http://localhost:5173>:

   ```bash
   npm run dev
   ```

`.env.local` is git-ignored. Never commit it, and never put a secret (service role) key in it: every `VITE_` and `NEXT_PUBLIC_` variable ends up in the browser bundle.

To find your way around the code, read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). It covers the folder layout, the Zustand stores, routing and role guards, the database schema and the security model.

## Branches and pull requests

1. Make sure your fork's `main` is up to date with the upstream `main`.
2. Create a branch with a short, descriptive name, for example:
   - `fix/kanban-drop-on-hold`
   - `feat/ticket-labels`
   - `docs/setup-vercel-steps`
3. Make your change. Keep each pull request focused on one thing; unrelated clean-ups are easier to review as separate pull requests.
4. Run the checks described in [Before you open a pull request](#before-you-open-a-pull-request).
5. Push the branch to your fork and open a pull request against `main`. Fill in the pull request template, link the issue it solves (for example `Closes #123`), and add screenshots for anything visual.
6. A maintainer will review it. Please keep the discussion on the pull request, and push follow-up commits to the same branch.

## Coding conventions

There is no formatter configured, so the main rule is: **match the style of the file you are editing.** The conventions below are the ones the codebase already follows.

### TypeScript and React

- TypeScript runs in `strict` mode with `noUnusedLocals` and `noUnusedParameters`. Unused variables and imports fail the build.
- Avoid `any` in new code. Row types live in `src/types/index.ts` (and in a few stores); extend them rather than casting.
- Components are function components with hooks. Pages and most components use a single `export default function Name()` per file.
- Two-space indentation and single quotes are the norm.
- Write comments that explain *why* something is done, especially when it works around a Supabase or browser behavior.

### Styling

- Style with Tailwind utility classes in JSX. Avoid new CSS files.
- Use the theme color tokens (`primary-*`, `gray-*`, `canvas`, `surface-dark`) instead of hard-coded colors. They are CSS variables defined per theme in `src/themes.css`, so your UI works with all six color themes.
- Add `dark:` variants for anything you style; dark mode is toggled with the `dark` class on `<html>`.
- Icons come from `lucide-react`.
- Check your change at desktop width, and below 768 px if it affects the mobile layout.

### State and data

- Shared data lives in Zustand stores in `src/store/`, one store per domain (`useTicketStore`, `useKbStore`, ...). Add actions to the matching store rather than fetching the same data from several components.
- Always use the single Supabase client exported from `src/lib/supabase.ts`.
- Report success and failure to the user with `react-hot-toast` (`toast.success` / `toast.error`), as the existing stores do.
- For drag-and-drop or other instant UI, update the store optimistically and re-fetch or roll back on error.
- Never use a secret or service role key in frontend code. Operations that need elevated rights belong in the `admin-actions` Edge Function, which must verify the caller's token and role before acting.
- Sanitize user-provided HTML with DOMPurify before rendering it with `dangerouslySetInnerHTML`.

## Database changes

The schema is defined in `supabase/migrations/`. The first file builds the whole schema and the second seeds the default admin.

- **Add a new timestamped migration file** for every change, for example with `npx supabase migration new add_ticket_labels`. Do not edit the existing files to change an installed database: they have already run on existing installs and would not run again.
- **Keep RLS on.** New tables need `ENABLE ROW LEVEL SECURITY`, explicit grants (nothing for `anon`), and policies built on the `get_my_role()` helper. Do not loosen an existing policy without discussing it in an issue first.
- Write migrations to be re-runnable where possible (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`).
- Update the matching TypeScript types; there are no generated database types.
- Test on a fresh database, for example `npx supabase db reset` on a local stack, so that new installs work too.
- In the pull request, explain how to apply the migration to an existing install.

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#9-changing-the-schema) explains the migration workflow, and the names the frontend depends on, in detail.

If you change `supabase/functions/admin-actions/index.ts`, keep its checks intact (valid token, active profile, per-action role check), keep returning errors as HTTP 200 with `{ "error": "..." }`, and say in the pull request that the function must be redeployed.

## Before you open a pull request

1. **Build.** This must pass; it type-checks the whole app and builds the production bundle:

   ```bash
   npm run build
   ```

2. **Lint.**

   ```bash
   npm run lint
   ```

   The codebase currently has existing lint debt: roughly 90 errors, almost all `@typescript-eslint/no-explicit-any`, plus some `react-hooks/exhaustive-deps` warnings. So `npm run lint` does not exit cleanly yet. Please make sure you **do not add new problems** in the files you touch. You can lint just those files:

   ```bash
   npx eslint src/components/YourComponent.tsx
   ```

   Pull requests that pay down the lint debt are welcome, as separate, focused changes.

3. **Test by hand.** There is no automated test suite yet. Try your change as each role it affects (admin, developer, support desk, branch manager). You can create test users in **Admin > Users > Invite User**. Check light and dark mode.

4. **Update the docs** if you changed behavior, setup steps or configuration.

## Demo data and privacy

Issues, pull requests, screenshots and documentation are public.

- Use fictional names and companies, and `@example.com` email addresses, in screenshots, examples and test data.
- Never post real customer data, project URLs with keys, access tokens or passwords.
- Before sharing a screenshot or log, check it for keys and personal data.

## Good first issues

Start with [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md), and look for issues labelled `good first issue`. Documentation fixes are also a great way to start. If you want to work on something, comment on the issue so nobody else duplicates the work.

## Commit messages

We suggest the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) style. It is not enforced, but it keeps the history easy to scan and helps with the [changelog](CHANGELOG.md):

```text
<type>(<optional scope>): <short summary in the imperative mood>

<optional body: what changed and why>
```

Common types are `feat`, `fix`, `docs`, `refactor`, `perf`, `style`, `chore` and `db` (a schema change). Examples:

```text
fix(kanban): keep the card in place when an approval gate blocks the move
feat(kb): search articles with the full-text index
docs(setup): clarify where to find the publishable key
```

Keep the summary under about 72 characters.

## License of contributions

FlowDesk is released under the [MIT License](LICENSE). By submitting a contribution, you agree that it is licensed under the same MIT License, and you confirm that you have the right to submit it. There is no separate contributor license agreement.
