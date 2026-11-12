from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("reviews", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="LocalReview",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("issue_key", models.CharField(max_length=80)),
                ("project_key", models.CharField(max_length=40)),
                ("summary", models.CharField(max_length=180)),
                ("revision", models.PositiveIntegerField(default=0)),
                ("document", models.JSONField(default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("owner", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                             related_name="scopeproof_local_reviews",
                                             to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddConstraint(
            model_name="localreview",
            constraint=models.UniqueConstraint(
                fields=("owner", "issue_key"),
                name="scopeproof_local_owner_issue_uniq",
            ),
        ),
        migrations.AddIndex(
            model_name="localreview",
            index=models.Index(
                fields=["owner", "project_key"],
                name="scopeproof_local_owner_proj_idx",
            ),
        ),
    ]
