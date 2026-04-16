from django.urls import include, path

from . import views


urlpatterns = [
    path("signup/", views.signup_view, name="account_signup"),
    path("profile/", views.profile_view, name="account_profile"),
    path("profile/edit/", views.profile_edit_view, name="account_profile_edit"),
    path("", include("allauth.urls")),
]
