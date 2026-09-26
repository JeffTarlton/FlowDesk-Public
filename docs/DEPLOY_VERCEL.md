# Deploying FlowDesk to Vercel

FlowDesk builds to a folder of static files (HTML, JavaScript, CSS), so any static host can serve it. This guide uses [Vercel](https://vercel.com), because its free **Hobby** plan, GitHub integration and automatic HTTPS make it the easiest option.

**Before you start**, finish [SETUP.md](SETUP.md) steps 1 to 6: the database is created, the `admin-actions` Edge Function is deployed, public sign-ups are off, and you have your **Project URL** and **publishable (or anon) key**. Ideally, you have also seen FlowDesk work locally (step 7). Vercel only hosts the website; it uses the same Supabase project.

> Vercel's Hobby plan is free for personal, non-commercial use. Check [Vercel's plans](https://vercel.com/pricing) if you run FlowDesk for a business.

**Contents**

1. [Put the code in your GitHub account](#1-put-the-code-in-your-github-account)
2. [Import the repository into Vercel](#2-import-the-repository-into-vercel)
3. [Check the build settings](#3-check-the-build-settings)
4. [Add the environment variables](#4-add-the-environment-variables)
5. [Deploy](#5-deploy)
6. [Tell Supabase about your Vercel address](#6-tell-supabase-about-your-vercel-address)
7. [Sign in](#7-sign-in)
- [Updating your site](#updating-your-site)
- [Changing environment variables later](#changing-environment-variables-later)
- [Node.js version](#nodejs-version)
- [Custom domain](#custom-domain)
- [What vercel.json does](#what-verceljson-does)
- [Optional: the Vercel Supabase integration](#optional-the-vercel-supabase-integration)
- [Problems?](#problems)

---

## 1. Put the code in your GitHub account

Vercel deploys from a Git repository that you control.

- **Easiest:** open https://github.com/OWNER/flowdesk and click **Fork**. Your fork is at `https://github.com/<your-username>/flowdesk`.
- **Or**, if you cloned or downloaded the code, create a new empty repository on GitHub and push the code to it:

  ```bash
  git remote set-url origin https://github.com/<your-username>/flowdesk.git
  git push -u origin main
  ```

  (If you downloaded a ZIP, run `git init`, `git add .` and `git commit -m "Initial commit"` first, then `git remote add origin ...` instead of `set-url`.)

Your `.env.local` file is git-ignored, so your keys are **not** pushed. That is correct: you give Vercel the values separately in step 4.

---

## 2. Import the repository into Vercel

1. Sign up or sign in at https://vercel.com, using **Continue with GitHub** so Vercel can see your repositories.
2. Start a new project: click **Add New...** and choose **Project**, or go straight to https://vercel.com/new.
3. Find your `flowdesk` repository in the list and click **Import**.
   If it is not listed, use the option to adjust the GitHub App permissions and give Vercel access to the repository, then come back.

You are now on the **Configure Project** page. Do not click **Deploy** yet.

---

## 3. Check the build settings

Vercel detects Vite automatically. Check that the page shows:

| Setting | Value |
|---|---|
| **Framework Preset** | **Vite** |
| **Root Directory** | `./` (the repository root) |
| **Build Command** | `npm run build` (runs `tsc -b && vite build`) |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` (the default) |

These are Vercel's defaults for Vite, so you normally do not need to override anything under **Build and Output Settings**.

---

## 4. Add the environment variables

Open the **Environment Variables** section on the same page and add:

| Name | Value | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Project URL, for example `https://abcdefghijklmnopqrst.supabase.co` | Yes |
| `VITE_SUPABASE_ANON_KEY` | Your publishable key (`sb_publishable_...`) or legacy `anon` key | Yes |
| `VITE_FULLCALENDAR_LICENSE_KEY` | Your FullCalendar Premium key, for the Calendar's Timeline view ([details](SETUP.md#optional-fullcalendar-timeline-license-key)) | No |

Tips:

- You can paste the contents of your `.env.local` into the first **Key** field; Vercel splits it into separate variables.
- Apply the variables to **Production** and **Preview**, so preview deployments of other branches work too.
- Copy values exactly: no quotes, no spaces, no trailing slash on the URL.

> [!WARNING]
> Every `VITE_` variable is **baked into the JavaScript at build time** and can be read by anyone who opens your site. That is fine for the Project URL and the publishable/anon key, which are designed to be public. **Never** put the secret key (`sb_secret_...`), the legacy `service_role` key or your database password into a `VITE_` (or `NEXT_PUBLIC_`) variable.

---

## 5. Deploy

Click **Deploy**. The build takes a minute or two. Warnings in the build log about large chunks are expected and harmless.

When it finishes, Vercel shows your production address, for example `https://flowdesk-abc123.vercel.app`. You can also find it later on the project's **Overview** page, under **Domains**.

Open it. You should see the FlowDesk sign-in page. If you see **"FlowDesk isn't configured yet"**, the environment variables were missing when the site was built: see [Changing environment variables later](#changing-environment-variables-later).

---

## 6. Tell Supabase about your Vercel address

In the Supabase dashboard, open **Authentication > URL Configuration** ([SETUP.md step 5](SETUP.md#set-the-site-url-and-redirect-urls)):

1. Set **Site URL** to your production address, for example `https://flowdesk-abc123.vercel.app`.
2. Under **Redirect URLs**, add `https://flowdesk-abc123.vercel.app/**` (keep `http://localhost:5173/**` for local development).
3. Optional, for preview deployments: add `https://*-<team-or-account-slug>.vercel.app/**`.
4. Save.

Password sign-in works without this, but it keeps any link Supabase generates pointing at your real site instead of `localhost`.

---

## 7. Sign in

Open your Vercel address and sign in with `Admin@flowdesk.com` / `Password2026!` (or with the password you already chose, if you signed in locally: it is the same database). On a first sign-in you must choose a new password. Then continue with [GETTING_STARTED.md](GETTING_STARTED.md).

---

## Updating your site

Vercel redeploys automatically:

- A push (or merged pull request) to your **production branch**, usually `main`, creates a new **production** deployment.
- A push to any other branch creates a **preview** deployment with its own address. Vercel may protect previews so that only members of your Vercel account can open them.

Changes to the SQL or the Edge Function are **not** deployed by Vercel. Apply those to Supabase yourself (see [ARCHITECTURE.md](ARCHITECTURE.md#9-changing-the-schema)).

To pull updates from the original project into your fork, use **Sync fork** on your fork's GitHub page.

## Changing environment variables later

Because `VITE_` values are compiled into the site during the build, **changing a variable does nothing until you redeploy**. Vercel applies environment variable changes only to new deployments.

1. Open your project on Vercel, then **Settings > Environment Variables**.
2. Add or edit the variable and click **Save**.
3. Go to **Deployments**, open the menu (**...**) on the latest production deployment and choose **Redeploy**. Or push a new commit.

## Node.js version

FlowDesk needs **Node.js 20 or newer**. `package.json` declares `"engines": { "node": ">=20" }`. Vercel treats an `engines` range like this as "use the newest available major version" (24.x at the time of writing), and it takes precedence over the **Node.js Version** dropdown in **Settings > Build and Deployment**. The build log may show a notice that the version upgrades automatically when a new major version is released. That is expected.

To pin a version, change the value in your fork's `package.json`, for example to `"22.x"`, and push. See [Vercel: supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## Custom domain

1. Open your project on Vercel, then **Settings > Domains**.
2. Click **Add Domain**, enter your domain (for example `flowdesk.example.com`) and follow the DNS instructions Vercel shows. HTTPS is set up for you.
3. Back in Supabase **Authentication > URL Configuration**, change the **Site URL** to the new domain and add `https://flowdesk.example.com/**` to the **Redirect URLs**.

No change to FlowDesk's code or environment variables is needed. See [Vercel: adding a custom domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

## What vercel.json does

The repository includes a small `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

FlowDesk is a single-page app: there is one real page, `index.html`, and addresses such as `/kanban` or `/admin` are handled in the browser by React Router. Without this rule, opening or refreshing `https://your-site/kanban` would return Vercel's 404 page, because no file called `kanban` exists. The rewrite serves `index.html` for those addresses, and the app then shows the right page. Real files, such as the JavaScript and CSS in `/assets/`, are still served normally. **Keep this file.** If you host FlowDesk somewhere else, configure the equivalent "fallback to index.html" rule there.

## Optional: the Vercel Supabase integration

Instead of typing the two variables in step 4, you can connect your Supabase project to Vercel with the [Supabase integration](https://vercel.com/marketplace/supabase). Choose to connect your **existing** project. The integration adds variables such as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (plus server-only ones like `SUPABASE_SECRET_KEY` and `POSTGRES_*`).

FlowDesk accepts those names as fallbacks (`src/lib/supabase.ts`; `vite.config.ts` exposes the `NEXT_PUBLIC_` prefix to the browser). The first name that is set wins:

| Setting | Names FlowDesk checks, in order |
|---|---|
| Project URL | `VITE_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` |
| Public key | `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` |

Things to know:

- The integration only provides settings. You still need to create the database, deploy `admin-actions` and turn off sign-ups ([SETUP.md](SETUP.md) steps 3 to 5).
- If you also set the `VITE_` variables, they take precedence.
- The server-only variables the integration adds (`SUPABASE_SECRET_KEY`, `POSTGRES_PASSWORD` and so on) are **not** included in the site, because FlowDesk only exposes `VITE_` and `NEXT_PUBLIC_` names. For the same reason, never give a secret a `NEXT_PUBLIC_` name in this project.
- After connecting, redeploy so the build picks up the new variables.

## Problems?

| Symptom | Where to look |
|---|---|
| "FlowDesk isn't configured yet" on the Vercel site | [Troubleshooting: not configured](TROUBLESHOOTING.md#flowdesk-isnt-configured-yet) |
| The build fails | [Troubleshooting: build fails](TROUBLESHOOTING.md#the-build-fails-or-an-old-nodejs-version-is-used) |
| 404 when refreshing a page | [Troubleshooting: 404 on refresh](TROUBLESHOOTING.md#404-not-found-when-opening-or-refreshing-a-page-on-vercel) |
| Works locally but not on Vercel | Check that both variables are set for the environment you are opening (Production or Preview), then redeploy. |

Everything else: [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
