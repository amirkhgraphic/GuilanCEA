from import_export import resources, fields
from import_export.widgets import ForeignKeyWidget, ManyToManyWidget

from payments.models import Payment, DiscountCode
from events.models import Event
from users.models import User

class DiscountResource(resources.ModelResource):
    event = fields.Field(
        column_name='applicable_events',
        attribute='applicable_events',
        widget=ManyToManyWidget(Event, field='title', separator='||')
    )

    class Meta:
        model = Event
        fields = (
            'id', 'code', 'type', 'value', 'max_discount', 'is_active',
            'starts_at', 'ends_at', 'usage_limit_total', 'usage_limit_per_user',
            'min_amount', 'applicable_events', 'created_at', 'updated_at',
            'is_deleted', 'deleted_at'
        )
        export_order = fields

class PaymentResource(resources.ModelResource):
    event = fields.Field(
        column_name='event',
        attribute='event',
        widget=ForeignKeyWidget(Event, 'title')
    )
    user = fields.Field(
        column_name='user',
        attribute='user',
        widget=ForeignKeyWidget(User, 'username')
    )

    class Meta:
        model = Payment
        fields = (
            'id', 'event', 'user', 'base_amount', 'discount_code', 'discount_amount', 'amount',
            'authority', 'status', 'red_id', 'card_pan', 'card_hash', 'verified_at', 'created_at',
            'updated_at', 'is_deleted', 'deleted_at'
        )
        export_order = fields
