from django.urls import path
from reviews.views import health, review_detail, review_command, project_reviews

urlpatterns = [
    path("health/", health, name="health"),
    path("api/v1/projects/<str:project_key>/reviews/", project_reviews, name="project-reviews"),
    path("api/v1/reviews/<str:issue_key>/", review_detail, name="review-detail"),
    path("api/v1/reviews/<str:issue_key>/commands/", review_command, name="review-command"),
]
