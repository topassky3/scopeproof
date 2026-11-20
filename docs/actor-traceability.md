# Actor names and historic evidence — QA

- The audit's stable Jira account IDs remain unchanged in Forge KVS; display names are fetched only for rendering.
- The UI queries the Jira bulk-user API as the **viewing Jira user**. It does not request emails or store Jira user profiles. Privacy settings and Jira permissions can limit returned display names.
- The app requests classic scope `read:jira-user` in addition to existing `read:jira-work`, `storage:app`. After deployment to development, grant the additional scope using `forge install --upgrade -e development` if required.
- When name resolution fails (403 / permissions, privacy, API outage), the timeline and Evidence still work and display a short stable user alias. Never invent a person's name.
- Historical titles are sourced exclusively from each requirement's `versions[]` snapshot. If a legacy snapshot is missing, say *Historical description unavailable* rather than displaying a later title as the original.
- QA read-only on ACD-1: EV-101 v1 displays original v1 wording and Passed + Outdated, EV-102 v2 displays v2 wording and Passed + Current. Both Evidence and History show actor display names if Jira provides them, otherwise stable aliases.
- Release safety: test locally, deploy only to Forge Development, verify Jira history retains seven events, then review before any changes to main or production.
