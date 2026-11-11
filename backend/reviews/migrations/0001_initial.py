from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="Review",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("installation_id", models.CharField(max_length=200)),
                ("issue_id", models.CharField(max_length=80)),
                ("issue_key", models.CharField(max_length=80)),
                ("project_id", models.CharField(max_length=80)),
                ("revision", models.PositiveIntegerField(default=0)),
                ("document", models.JSONField(default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.AddConstraint(
            model_name="review",
            constraint=models.UniqueConstraint(
                fields=("installation_id", "issue_id"),
                name="scopeproof_install_issue_uniq",
            ),
        ),
        migrations.AddIndex(
            model_name="review",
            index=models.Index(
                fields=["installation_id", "project_id"],
                name="scopeproof_install_proj_idx",
            ),
        ),
    ]
