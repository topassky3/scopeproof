"""Pure rules ported from src/domain.js. Data format matches the Forge MVP."""
from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4
from urllib.parse import urlsplit


class ReviewError(ValueError):
    pass


def blank_review(issue):
    return {
        "issueId": str(issue["id"]), "issueKey": issue["key"],
        "summary": issue["summary"], "projectId": str(issue["projectId"]),
        "projectKey": issue["projectKey"], "revision": 0,
        "requirements": [], "evidence": [], "approvals": [], "events": [],
    }


def summarize(review):
    requirements = review.get("requirements", [])
    evidence = review.get("evidence", [])
    mandatory = [r for r in requirements if r["mandatory"]]
    rows = []
    for r in requirements:
        matching = [e for e in evidence if e["requirementId"] == r["id"] and e["version"] == r["version"]]
        latest = matching[-1] if matching else None
        stale = any(e["requirementId"] == r["id"] and e["version"] < r["version"] for e in evidence)
        state = ("satisfied" if latest["result"] == "passed" else "failed") if latest else ("stale" if stale else "missing")
        rows.append({**r, "latestEvidence": latest, "state": state})
    covered = sum(1 for r in rows if r["mandatory"] and r["state"] == "satisfied")
    approvals = review.get("approvals", [])
    latest_approval = approvals[-1] if approvals else None
    snapshot_matches = False
    if latest_approval and latest_approval["type"] == "approved":
        snapshots = latest_approval.get("snapshot", [])
        snapshot_matches = len(snapshots) == len(mandatory) and all(
            (current := next((r for r in rows if r["id"] == s["requirementId"]), None))
            and current["version"] == s["version"]
            and current["latestEvidence"]
            and current["latestEvidence"]["id"] == s["evidenceId"]
            and current["state"] == "satisfied"
            for s in snapshots
        )
    status = "pending"
    if latest_approval and latest_approval["type"] == "rejected":
        status = "rejected"
    elif latest_approval and latest_approval["type"] == "approved":
        status = "approved" if snapshot_matches else "revalidation"
    elif requirements:
        status = "ready" if covered == len(mandatory) else "in-review"
    return {
        "rows": rows, "mandatory": len(mandatory), "covered": covered,
        "status": status, "blockers": [r for r in rows if r["mandatory"] and r["state"] != "satisfied"],
        "latestApproval": latest_approval,
    }


def _clean(value, max_length=500):
    return str(value if value is not None else "").strip()[:max_length]


def _event(review, kind, description, actor, timestamp):
    review["events"].append({
        "id": str(uuid4()), "type": kind, "description": description,
        "actor": actor, "createdAt": timestamp,
    })


def apply_command(original, command, actor):
    if not isinstance(command, dict):
        raise ReviewError("INVALID_REQUEST")
    revision = command.get("expectedRevision")
    if type(revision) is not int or revision != original["revision"]:
        raise ReviewError("CONFLICT: Review was updated. Reload before saving.")
    review = deepcopy(original)
    kind = command.get("type")
    now = datetime.now(timezone.utc).isoformat()
    if kind == "addRequirement":
        title = _clean(command.get("title"), 180)
        if len(title) < 5:
            raise ReviewError("A requirement title needs at least 5 characters.")
        ident = f'RQ-{len(review["requirements"]) + 1:02d}'
        review["requirements"].append({
            "id": ident, "title": title, "mandatory": command.get("mandatory") is not False,
            "version": 1, "versions": [{"version": 1, "title": title, "actor": actor, "createdAt": now}],
        })
        _event(review, "requirement-created", f"{ident} v1 created", actor, now)
    elif kind == "publishVersion":
        row = next((r for r in review["requirements"] if r["id"] == command.get("requirementId")), None)
        if not row:
            raise ReviewError("Requirement not found.")
        title = _clean(command.get("title"), 180)
        if len(title) < 5 or title == row["title"]:
            raise ReviewError("Enter a changed requirement title.")
        was_approved = summarize(review)["status"] == "approved"
        row["version"] += 1
        row["title"] = title
        row["versions"].append({"version": row["version"], "title": title, "actor": actor, "createdAt": now})
        _event(review, "requirement-updated", f'{row["id"]} updated to v{row["version"]}; evidence must be reviewed', actor, now)
        if was_approved:
            _event(review, "approval-revalidation", f'Prior approval requires revalidation because {row["id"]} changed', actor, now)
    elif kind == "addEvidence":
        row = next((r for r in review["requirements"] if r["id"] == command.get("requirementId")), None)
        if not row:
            raise ReviewError("Requirement not found.")
        result = command.get("result")
        if result not in ("passed", "failed"):
            raise ReviewError("Choose Passed or Failed.")
        title = _clean(command.get("title"), 180)
        if len(title) < 3:
            raise ReviewError("Provide a short evidence title.")
        link = _clean(command.get("url"))
        if link and (urlsplit(link).scheme.lower() != "https" or not urlsplit(link).netloc):
            raise ReviewError("Evidence URL must use HTTPS.")
        ident = f'EV-{len(review["evidence"]) + 101}'
        review["evidence"].append({
            "id": ident, "requirementId": row["id"], "version": row["version"],
            "title": title, "url": link, "result": result, "actor": actor, "createdAt": now,
        })
        _event(review, "evidence-added", f'{ident} {result} for {row["id"]} v{row["version"]}', actor, now)
    elif kind == "approve":
        state = summarize(review)
        if not state["mandatory"] or state["blockers"]:
            raise ReviewError("APPROVAL_BLOCKED: All mandatory requirements need current passing evidence.")
        snapshot = [{
            "requirementId": r["id"], "version": r["version"], "evidenceId": r["latestEvidence"]["id"],
        } for r in state["rows"] if r["mandatory"]]
        review["approvals"].append({
            "id": str(uuid4()), "type": "approved", "actor": actor, "createdAt": now,
            "note": _clean(command.get("note")), "snapshot": snapshot,
        })
        _event(review, "review-approved", f"Review approved with {len(snapshot)} mandatory requirements", actor, now)
    elif kind == "reject":
        note = _clean(command.get("note"))
        if len(note) < 5:
            raise ReviewError("A rejection reason is required.")
        review["approvals"].append({
            "id": str(uuid4()), "type": "rejected", "actor": actor,
            "createdAt": now, "note": note, "snapshot": [],
        })
        _event(review, "review-rejected", "Review rejected", actor, now)
    else:
        raise ReviewError("Unknown command.")
    review["revision"] += 1
    return review
