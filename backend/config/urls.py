from django.urls import path
from accounts.views import session_status, sign_in, sign_out, sign_up
from reviews.views import health, review_detail, review_command, project_reviews
from reviews.local_views import (
    local_review_list, local_review_create,
    local_review_detail, local_review_command,
)

urlpatterns = [
    path("health/", health, name="health"),
    path("api/local/auth/session/", session_status, name="local-session"),
    path("api/local/auth/login/", sign_in, name="local-login"),
    path("api/local/auth/register/", sign_up, name="local-register"),
    path("api/local/auth/logout/", sign_out, name="local-logout"),
    path("api/local/reviews/", local_review_list, name="local-reviews-list"),
    path("api/local/reviews/new/", local_review_create, name="local-review-create"),
    path("api/local/reviews/<str:issue_key>/", local_review_detail, name="local-review-detail"),
    path("api/local/reviews/<str:issue_key>/commands/", local_review_command, name="local-review-command"),
    path("api/v1/projects/<str:project_key>/reviews/", project_reviews, name="project-reviews"),
    path("api/v1/reviews/<str:issue_key>/", review_detail, name="review-detail"),
    path("api/v1/reviews/<str:issue_key>/commands/", review_command, name="review-command"),
]
