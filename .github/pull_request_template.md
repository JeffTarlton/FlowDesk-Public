## Summary

<!-- What does this pull request change, and why? -->

Closes #<!-- issue number, if there is one -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Database schema change (new migration file)
- [ ] `admin-actions` Edge Function change
- [ ] Documentation
- [ ] Refactoring or clean-up (no behavior change)

## How it was tested

<!--
Describe what you tried and on which setup (hosted or local Supabase).
List the roles you tested as, and whether you checked dark mode and narrow screens where relevant.
-->

## Screenshots

<!-- For UI changes: before and after. Use fictional data and @example.com addresses only. -->

## Database and Edge Function changes

<!-- Delete this section if it does not apply. -->

- [ ] Schema changes are in a **new** timestamped file in `supabase/migrations/`; existing migration files are unchanged.
- [ ] New tables have RLS enabled, explicit grants (nothing for `anon`) and policies.
- [ ] TypeScript types were updated to match.
- [ ] Steps to apply this to an existing install are described above (for example, redeploy `admin-actions`).

## Checklist

- [ ] `npm run build` passes.
- [ ] `npm run lint` reports no new problems in the files I changed.
- [ ] I updated the documentation, if behavior or setup changed.
- [ ] I added a line under `[Unreleased]` in `CHANGELOG.md`, if the change is user-facing.
- [ ] This pull request contains no secrets, keys, passwords or real customer data.
