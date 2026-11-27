# ScopeProof — Privacy notice

**Draft for Codegeist evaluation — 27 November 2026. Not yet approved for external distribution.**

## Scope and provider

This notice describes the ScopeProof Forge app for Jira, developed by the ScopeProof team under YarumalTech. It covers the Forge release candidate, not the separate local Django or Next.js development tools. ScopeProof is intended for evaluation on a dedicated test Jira site using synthetic project and evidence content.

## Data processed

- Jira issue and project identifiers, issue keys and summaries needed to identify authorized review contexts.
- Atlassian account IDs associated with actions, requirement versions, evidence, decisions and audit events; timestamps and user-entered descriptions, notes, results and optional evidence URLs.
- Jira profile display names retrieved when available for display; stored actor identifiers are used to preserve attribution. A pseudonymous label may be shown if a display name cannot be resolved.
- Technical information made available by Atlassian Forge, such as installation metadata, logs and operational metrics. Support requests may contain information voluntarily provided by the requester.

Do not enter confidential, sensitive or real customer information during evaluation. Synthetic content does not make the account IDs of actual users anonymous.

## Purpose and access

The app uses these data to maintain versioned requirements, evidence applicability, explicit approval decisions, change-impact analysis, recovery plans, historical traceability and report exports. The organization installing the app should determine its lawful basis and inform its users. ScopeProof does not use review data for advertising or sale. The Forge release uses Jira access checks under the acting user's identity and checks issue-edit permissions before review writes. Separate approver roles are not implemented.

## Storage, processing and disclosures

The Forge release uses Atlassian-hosted Custom Entity Store and legacy Key-Value Store compatibility. Its manifest does not declare a remote backend or external data-egress permissions. The Forge platform processes data under its applicable terms and infrastructure policies. Authorized team members may access platform-provided diagnostic information where necessary to troubleshoot. Reports can be exported by authorized users as PDF or JSON; the receiving organization controls copies it downloads or shares. Optional evidence links are user-supplied references, not independently verified results; following a link may take a user to another service.

## Retention and individual rights

RC1 retains historical review records as part of its audit model and does not implement a configurable retention schedule or an automated account-level erasure/rectification workflow. The team must establish a tested process for access, correction, erasure and periodic account reporting before external distribution. Uninstallation and deletion of Forge-hosted data are subject to Atlassian's retention and recovery procedures; uninstalling does not guarantee immediate permanent deletion. Exported copies are outside the app's direct control.

Users may request access, correction or deletion through their site administrator and the ScopeProof support channel. Do not submit personal data, account IDs, screenshots containing private information, or deletion-request details in a public issue. Request a private support channel first. A private contact and a verified fulfillment process must be established before external use.

## Security and limitations

The release implements issue authorization, record validation and revision-conditional writes. These controls are not an independent security certification. ScopeProof's evidence records are user assertions and its audit history is not an independently immutable ledger. Use only synthetic evaluation data until privacy release requirements have been verified.

## Contact and references

- Public support (non-sensitive inquiries only): https://github.com/topassky3/scopeproof/issues
- Atlassian privacy guide for Forge developers: https://developer.atlassian.com/platform/forge/user-privacy-guidelines/
- Forge hosted-storage lifecycle: https://developer.atlassian.com/platform/forge/storage-reference/hosted-storage-data-lifecycle/
- Atlassian privacy policy: https://www.atlassian.com/legal/privacy-policy

This draft requires owner approval, confirmation of a private support channel, and closure of the privacy release gate before it is used as the external installation notice.
