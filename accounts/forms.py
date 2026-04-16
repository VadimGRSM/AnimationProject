from allauth.account.forms import LoginForm, ResetPasswordForm
from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from .models import Profile

User = get_user_model()


class StyledFieldsMixin:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            existing = field.widget.attrs.get("class", "")
            field.widget.attrs["class"] = (f"{existing} auth-field__input").strip()


class CustomLoginForm(StyledFieldsMixin, LoginForm):
    pass


class CustomResetPasswordForm(StyledFieldsMixin, ResetPasswordForm):
    pass


class SignUpForm(StyledFieldsMixin, forms.ModelForm):
    password1 = forms.CharField(
        label="Password",
        strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
    )
    password2 = forms.CharField(
        label="Confirm password",
        strip=False,
        widget=forms.PasswordInput(attrs={"autocomplete": "new-password"}),
    )

    class Meta:
        model = User
        fields = ("email", "display_name")
        widgets = {
            "email": forms.EmailInput(
                attrs={
                    "placeholder": "you@example.com",
                    "autocomplete": "email",
                }
            ),
            "display_name": forms.TextInput(
                attrs={
                    "placeholder": "How should we call you?",
                    "autocomplete": "name",
                }
            ),
        }

    def clean_email(self):
        email = (self.cleaned_data.get("email") or "").strip().lower()
        if not email:
            raise forms.ValidationError("Enter an email address.")
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("A user with this email already exists.")
        return email

    def clean_display_name(self):
        value = (self.cleaned_data.get("display_name") or "").strip()
        if not value:
            raise forms.ValidationError("Enter a display name.")
        return value

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get("password1")
        password2 = cleaned_data.get("password2")

        if password1 and password2 and password1 != password2:
            self.add_error("password2", "Passwords do not match.")

        if password1:
            user = User(
                email=cleaned_data.get("email"),
                display_name=cleaned_data.get("display_name"),
            )
            try:
                validate_password(password1, user=user)
            except ValidationError as error:
                self.add_error("password1", error)

        return cleaned_data

    def save(self):
        user = User.objects.create_user(
            email=self.cleaned_data["email"],
            password=self.cleaned_data["password1"],
            display_name=self.cleaned_data["display_name"],
            first_name=self.cleaned_data["display_name"],
        )
        return user


class ProfileEditForm(StyledFieldsMixin, forms.ModelForm):
    display_name = forms.CharField(
        label="Display name",
        max_length=150,
        widget=forms.TextInput(
            attrs={
                "placeholder": "How your name appears in the project",
                "autocomplete": "nickname",
            }
        ),
    )
    avatar = forms.ImageField(
        label="Avatar",
        required=False,
        widget=forms.ClearableFileInput(attrs={"accept": "image/*"}),
    )

    class Meta:
        model = Profile
        fields = ("theme_preference",)
        widgets = {
            "theme_preference": forms.Select(),
        }

    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop("user")
        super().__init__(*args, **kwargs)
        self.fields["display_name"].initial = self.user.display_name
        self.fields["avatar"].initial = self.user.avatar

    def clean_display_name(self):
        value = (self.cleaned_data.get("display_name") or "").strip()
        if not value:
            raise forms.ValidationError("Enter a display name.")
        return value

    def save(self, commit=True):
        profile = super().save(commit=False)
        self.user.display_name = self.cleaned_data["display_name"]
        self.user.first_name = self.cleaned_data["display_name"]
        avatar = self.cleaned_data.get("avatar")
        if avatar is not None:
            self.user.avatar = avatar

        if commit:
            self.user.save(update_fields=["display_name", "first_name", "avatar"])
            profile.user = self.user
            profile.save()
        return profile
