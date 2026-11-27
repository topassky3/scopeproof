# ScopeProof — Codegeist delivery roadmap

Status baseline: 27 November 2026. The candidate [`scopeproof-codegeist-rc1`](https://github.com/topassky3/scopeproof/tree/scopeproof-codegeist-rc1) resolves to `82c55e60fdfe1d762f0cff3ae7acd9ab2fc1c203` and is integrated in `main`. Preserve this tag; documentation may evolve without changing the validated application source.

## Completed engineering milestones (RC1)

- [x] Forge project page and issue panel, feature-first UI and seven screens.
- [x] Versioned requirements, version-specific evidence, explicit decisions and historical traceability.
- [x] Integrity guards, causal diagnosis and recovery planner.
- [x] PDF and JSON snapshot reports.
- [x] Engine optimization and mathematical recovery experiments under stated assumptions.
- [x] Forge development deployment and real Jira functional demonstration.
- [x] Conditional CES persistence and tested same-issue/cross-issue concurrency.
- [x] Acting-user read and edit authorization exercised with two identities.
- [x] Clean install, 287 automated core tests, production build, dependency audit and Forge lint.
- [x] Review of six divergent contribution branches; relevant changes already present or superseded by RC1.
- [x] Publish candidate tag and integrate `main`; five successful CI runs for the candidate commit.

These milestones are limited to the recorded acceptance scenarios. They do not establish production readiness or comprehensive security assurance.

## Submission work (internal targets)

| Phase | Deliverable | Target | Status at baseline |
| --- | --- | --- | --- |
| J19A | English README, architecture and evidence inventory | 28–29 Nov | In progress |
| J19B | Mathematical specification, experimental evidence and reproducibility notes | 30 Nov–2 Dec | Pending |
| J19C | Competitive narrative and value proposition | 3–4 Dec | Pending |
| J19D | Devpost application, eligibility and installation verification | 5–6 Dec | Pending |
| J19E | Recorded demonstration and final video review | 7–8 Dec | Pending |
| J20 | First complete submission candidate | 9 Dec | Pending |

Dates above are team planning targets, not verified contest deadlines. Confirm the current [official rules](https://codegeist2026.devpost.com/rules) before submission. The existing development-site URL is not proof of a usable judge installation link.

## Final submission gate

- [ ] Verify official eligibility, category, deadline, judge access and demonstration requirements.
- [ ] Prepare a usable distribution/install link and test it as an intended external user in the appropriate environment.
- [ ] Produce the mathematical model and explain its assumptions, baseline and limitations.
- [ ] Preserve reproducible evidence for the exact candidate, without publishing sensitive Jira data or identifiers.
- [ ] Explain the stale-view observation, bounded index/storage, and limits of permission and concurrency tests.
- [ ] Confirm documentary evidence of the private test-space permission setup or record it as unconfirmed.
- [ ] Review final documentation, links, claims and screenshots in English.
- [ ] Record and review the demonstration video against current contest rules.
- [ ] Complete and verify the actual submission; retain confirmation.

## Deferred beyond RC1

Separate approver roles and multi-reviewer workflows, independently immutable audit storage, independent verification of evidence, automated arbitrary Jira-change detection, notifications, external CI integrations, production observability, larger-scale persistence, and additional performance/UX improvements are outside the validated candidate. Dependency and bundle-size warnings remain documented. Only a verified blocker or an explicit submission requirement should justify reopening functional development.
