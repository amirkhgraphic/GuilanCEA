from django import template
from django.utils import timezone
import jdatetime
import zoneinfo

register = template.Library()
TEHRAN_TZ = zoneinfo.ZoneInfo("Asia/Tehran")
PERSIAN_MAP = str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")

@register.filter
def jdate(value, fmt="%Y/%m/%d %H:%M"):
    """Convert aware/naive datetime to Tehran TZ and format as Jalali."""
    if not value:
        return ""
    # به زمان تهران
    dt = timezone.localtime(value, TEHRAN_TZ) if timezone.is_aware(value) else value.replace(tzinfo=TEHRAN_TZ)
    jdt = jdatetime.datetime.fromgregorian(datetime=dt)
    return jdt.strftime(fmt)

@register.filter
def fa_digits(value):
    """Convert ASCII digits to Persian digits."""
    return str(value).translate(PERSIAN_MAP)
