# Scopeproof — visual welcome and login concept

**Status:** UI-only local preview. No login provider, user credential collection, session minting, or authorization gate is implemented by this screen.

## User journey

1. Start the frontend with `npm.cmd run dev`.
2. The initial local screen is the Scopeproof welcome / sign-in concept.
3. `Continue with Atlassian` is intentionally disabled in the standalone preview. In real Forge usage, Jira already signs in the user and authenticates access to the app.
4. `Explore interactive demo` opens the existing Scopeproof app and uses the explicitly labeled sample data already provided by the local preview.
5. `Back to welcome` returns to the sign-in concept. No Jira credentials or passwords are requested.

## Architecture and safety

- `src/features/auth/LoginPage.tsx` + `login.css`: presentational screen; styles scoped to `.sp-login*`.
- `src/app/Entry.tsx`: selects the local welcome screen when `import.meta.env.DEV`, and renders `<App/>` directly when built for Forge.
- `src/domain.js`, `src/index.js`, `manifest.yml`, Forge KVS and Jira permission checks remain unchanged.
- Do **not** add a fake email/password form for Atlassian accounts. Actual Atlassian/Jira authentication and authorization are provided by the platform.

This design is for UI feedback and iteration. A public standalone SaaS login page, if later required, needs a separate approved OAuth/OIDC architecture, application registration, callback handling and a full security review.
