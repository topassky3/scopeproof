from django.db import models


class Review(models.Model):
    """One aggregate per Jira issue AND Forge installation (tenant isolation)."""
    installation_id = models.CharField(max_length=200)
    issue_id = models.CharField(max_length=80)
    issue_key = models.CharField(max_length=80)
    project_id = models.CharField(max_length=80)
    revision = models.PositiveIntegerField(default=0)
    document = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["installation_id", "issue_id"],
                name="scopeproof_install_issue_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["installation_id", "project_id"],
                name="scopeproof_install_proj_idx",
            ),
        ]
