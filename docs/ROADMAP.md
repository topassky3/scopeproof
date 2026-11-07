# Codegeist 2026 delivery roadmap

## Milestone 0 — Repository and starter
- [x] Pure domain rules and automated unit tests
- [x] React starter covering Overview, Reviews, Requirements, Evidence, History, Reports, Settings
- [x] Forge manifest for Jira project page + issue panel
- [ ] Install NPM packages, create and commit `package-lock.json` with `npm install`
- [ ] Verify `npm run build` and `forge lint`
- [ ] Publish the GitHub repository

## Milestone 1 — Forge live integration (highest priority)
- [ ] `forge login` and `forge register` ONCE
- [ ] `forge deploy` and `forge install --demo-site`
- [ ] Real issue access by Jira key
- [ ] Create three requirements, enter evidence, and store via Forge KVS
- [ ] Confirm a changed requirement invalidates previous approval
- [ ] Verify History after reload
- [ ] Confirm `EDIT_ISSUES` and privacy boundaries

## Milestone 2 — Quality gate
- [ ] Test all browser actions inside Jira, not only the local preview
- [ ] Test 403s, missing issues, recovery, and accessibility
- [ ] Implement atomic/transactional update protection
- [ ] Restrict approval to nominated reviewers, server-side
- [ ] Ensure immutable audit trail or append-only events
- [ ] Use real named issue from demo tenant, no production private data

## Milestone 3 — Submission
- [ ] Demo script under 3 minutes, explain product difference
- [ ] Create public YouTube demo under 5 minutes
- [ ] Judges can install app with provided link
- [ ] README/screenshots in English, app description, validation checklist
- [ ] Submit to Codegeist by Dec 22, 2026

## Explicitly deferred
- PDF generation, full notifications, semantic AI analysis, Billing, external CI integrations.
