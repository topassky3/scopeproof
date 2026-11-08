# Scopeproof — Evidence-aware delivery for Jira

**Atlassian Codegeist 2026 · Apps for Software Teams · Starter v0.1**

Scopeproof helps teams detect when a previously approved Jira issue no longer has current evidence for changed requirements. The main demonstration is: **passing evidence → approval → requirement v2 → previous evidence becomes stale → revalidation → new evidence → fresh approval**.

## Technical stack

- Atlassian Forge `jira:projectPage` + `jira:issuePanel` (Custom UI).
- React + TypeScript + Vite + lightweight CSS.
- Forge resolver checks access through Jira's REST API as the acting user.
- Forge KVS stores reviews per Jira issue. Forge isolates app installations.
- Pure JavaScript domain rules and Node's built-in test runner.

## Local setup (Windows PowerShell)

Requires Git, GitHub CLI (`gh`), npm, and **Node.js 24.22.1+ or 22.23.4+** for the Forge CLI.

```powershell
npm install
npm test
npm run build
npm run dev
```

`npm run dev` opens a **labeled sample-data preview** at `http://127.0.0.1:5173`. Sample data is stored only in the browser for UI prototyping; it is not Jira data.

## Install on Jira with Forge

```powershell
npm install -g @forge/cli@latest
forge login
forge register Scopeproof  # Run ONCE per new fork/copy, replaces the placeholder app ID
npm run build
forge deploy
forge install --demo-site
```

If you already registered this app, do **not** run `forge register` again. It changes the app identity, environments and storage association.

Alternatively, use an existing developer site and run `forge install`.

Open the **Scopeproof** tab from your Jira project or **Scopeproof Evidence** panel on an issue. The first time you access data, Jira may ask for the scope permissions. The Project Page lets you enter an issue key you can access; the Issue Panel can determine it from Jira context.

## GitHub setup (one time)

```powershell
gh auth status
git init -b main
git add .
git commit -m "feat: bootstrap Scopeproof Codegeist 2026"
gh repo create topassky3/scopeproof --public --source . --remote origin --push
```

The repository will be public; do not commit API tokens, secrets or private user data. To work together, invite your teammate through GitHub repository settings once their GitHub username is known.

For the shared component architecture and design implementation plan, see [`docs/SHARED_UI.md`](docs/SHARED_UI.md).

## Frontend architecture

The UI uses a **feature-first** structure: reusable layout, components, types, and styles live in `src/shared/`; each screen lives in `src/features/<name>/`; the Forge/local preview coordinator lives in `src/app/`. See [`docs/FEATURE_ARCHITECTURE.md`](docs/FEATURE_ARCHITECTURE.md).

## Navigation

- **Overview / Reviews** — active review, status and coverage.
- **Requirements** — create a mandatory requirement, publish a new version.
- **Evidence** — add passing/failing evidence attached to a requirement version.
- **History** — trace requirement versions, evidence, review decisions.
- **Reports** — export the current review as JSON.
- **Settings** — current MVP policy (informational, not configurable yet).

## Verification demo

1. In a real Jira issue, add 3 mandatory requirements.
2. Register a passing evidence record for each one.
3. Approve the review.
4. Publish a new version of one requirement.
5. Observe status **Revalidation required** and stale evidence.
6. Add new passing evidence for that version, then approve again.
7. Check that the previous approval remains visible in History and the JSON report.

In local development, the preloaded sample starts at step 5.

## Honest current scope and known limitations

- **Implemented in source:** core state rules, form actions, Jira read/write authorization checks, Forge KVS persistence logic, history, JSON export, and seven domain tests.
- **Not yet verified on Atlassian:** Forge registration, actual install, deploy, and `npm run build`. Must be completed on a machine with npm network access and Atlassian credentials.
- **Important:** the optimistic revision check handles sequential stale saves, but `kvs.get` + `kvs.set` is **not atomic**, so parallel updates may race. Add Forge storage transactions or compare-and-swap before production use.
- **Permissions:** any user with Jira `EDIT_ISSUES` can currently perform all writes, including approval; separate reviewer/admin role permissions are not implemented. This is a pre-production gap.
- **Reports:** JSON works; PDF/CSV UI mockups remain unimplemented.
- **Not implemented:** automatic detection of edits made directly to Jira's issue description, notifications, advanced analytics, multi-reviewer workflow, proper audit immutability guarantees, settings mutation, external evidence verification and production observability.
- **Dashboard index:** uses a simple KVS project index optimized for small demos, not high concurrency/scale.

Review the backlog in `docs/ROADMAP.md`, and use `docs/design/` as a visual direction rather than exact browser screenshots of the implemented app.

## Contest

Official rules: https://codegeist2026.devpost.com/rules

Deadline: **Dec 22, 2026, 12:00pm PST**. You need a working Forge app integrated with Atlassian, a judge installation link, and a public YouTube demo shorter than 5 minutes (judges aren't required to watch beyond 3 minutes).
