from django import forms

from unfold.widgets import UnfoldAdminTextInputWidget, UnfoldAdminTextareaWidget

from events.models import Registration


class AnnouncementForm(forms.Form):
    subject = forms.CharField(
        label="Subject", 
        max_length=200,
        widget=UnfoldAdminTextInputWidget,
    )
    body_html = forms.CharField(
        label="Text (HTML or plain-text)",
        widget=UnfoldAdminTextareaWidget,
        help_text="you can enter either HTML or plain-text."
    )
    statuses = forms.MultipleChoiceField(
        label="Statuses to sent",
        required=False,
        choices=Registration.StatusChoices.choices,
        initial=[Registration.StatusChoices.CONFIRMED, Registration.StatusChoices.ATTENDED],
        widget=forms.CheckboxSelectMultiple,
    )
