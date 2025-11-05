from import_export import resources, fields
from import_export.widgets import BooleanWidget

from users.models import User

class UserResource(resources.ModelResource):
    is_staff = fields.Field(
        column_name='is_staff',
        attribute='is_staff',
        widget=BooleanWidget()
    )
    is_superuser = fields.Field(
        column_name='is_superuser',
        attribute='is_superuser',
        widget=BooleanWidget()
    )
    is_email_verified = fields.Field(
        column_name='is_email_verified',
        attribute='is_email_verified',
        widget=BooleanWidget()
    )

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name',
                 'student_id', 'year_of_study', 'major',
                  'is_staff', 'is_superuser',
                  'is_email_verified', 'bio')
        export_order = fields
