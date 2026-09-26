---
name: Bug report
about: Something in FlowDesk does not work as expected
title: "[Bug]: "
labels: bug
assignees: ''
---

<!--
Thanks for reporting a bug! Before you submit:
- Search the existing issues and docs/KNOWN_ISSUES.md; it may already be known.
- Security vulnerabilities must NOT be reported here. Follow SECURITY.md instead.
- Never paste secret or service_role keys, passwords, access tokens or real customer data.
  Use fictional names and @example.com addresses in examples and screenshots.
-->

## What happened

A clear, short description of the bug.

## Steps to reproduce

1. Sign in as a user with the role: <!-- admin / developer / support_desk / branch_manager -->
2. Go to '...'
3. Click on '...'
4. See the problem

## Expected behavior

What you expected to happen.

## Actual behavior

What happened instead. Include the exact error message if there is one.

## Screenshots and console output

<!--
Optional. Screenshots help, and so do errors from the browser console (F12 > Console)
or from the admin-actions function logs in the Supabase dashboard. Remove keys and personal data first.
-->

## Environment

| | |
|---|---|
| FlowDesk version or commit | <!-- e.g. 1.0.0 or a commit hash --> |
| Browser and version | <!-- e.g. Chrome 128, Firefox 130, Safari 18 --> |
| Operating system | <!-- e.g. Windows 11, macOS 15, Ubuntu 24.04, iOS 18 --> |
| Screen | <!-- desktop, or mobile / narrow window (under 768 px) --> |
| Supabase | <!-- hosted (free or paid plan), or local with the Supabase CLI --> |
| Public key type | <!-- publishable (sb_publishable_...) or legacy anon --> |
| `admin-actions` Edge Function deployed | <!-- yes / no / not sure --> |
| Deploy target | <!-- Vercel, another static host, or local (npm run dev) --> |

## Additional context

Anything else that might help, such as whether it worked in an earlier version or only happens for one role.
