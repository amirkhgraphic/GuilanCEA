# users/management/commands/import_attendees.py
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from users.models import User
from events.models import Event, Registration
from utils.choices import MajorChoices, UniversityChoices

import os
import csv

# اگر openpyxl نصب بود، XLSX را هم می‌خوانیم
try:
    import openpyxl  # for xlsx
except Exception:
    openpyxl = None


def normalize(s):
    if s is None:
        return None
    # حذف فاصله‌های اضافی و نویزهای رایج
    s = str(s).replace("\u200c", " ").replace("\xa0", " ").strip()
    while "  " in s:
        s = s.replace("  ", " ")
    return s or None


def major_to_code(label):
    label = normalize(label)
    if not label:
        return None
    # نگاشت‌های مورد نیاز
    mapping = {
        "مهندسی کامپیوتر": MajorChoices.CE,  # "CE"
        "مهندسی صنایع": MajorChoices.IE,     # "IE"
    }
    return mapping.get(label, None)


def build_university_label_to_code():
    # UniversityChoices.choices -> [(value, label), ...]
    # ما می‌خواهیم label -> value
    m = {}
    for code, label in UniversityChoices.choices:
        m[normalize(label)] = code
    return m


def university_to_code(label, uni_map):
    label = normalize(label)
    if not label:
        return None
    # مثال‌ها: "دانشگاه گیلان" => "GILAN"
    return uni_map.get(label, None)


def ensure_unique_email(base_email):
    """
    اگر ایمیل تکراری بود، پسوند عددی اضافه می‌کنیم تا یونیک شود.
    """
    if not User.objects.filter(email=base_email).exists():
        return base_email
    name, at, host = base_email.partition("@")
    i = 2
    while True:
        cand = f"{name}+{i}@{host}"
        if not User.objects.filter(email=cand).exists():
            return cand
        i += 1


def ensure_unique_username(base_username):
    """
    اگر یوزرنیم تکراری بود، عدد انتها اضافه می‌کنیم.
    """
    base_username = (base_username or "imported").lower()
    if not User.objects.filter(username=base_username).exists():
        return base_username
    i = 2
    while True:
        cand = f"{base_username}{i}"
        if not User.objects.filter(username=cand).exists():
            return cand
        i += 1


def make_placeholder_email(student_id, first_name, last_name):
    base_slug = None
    if student_id:
        base_slug = f"pending-{student_id}"
    else:
        # اگر student_id نداشت، از نام و نام‌خانوادگی یک اسلاگ می‌سازیم
        base_slug = f"pending-{slugify((first_name or '') + '-' + (last_name or '')) or 'unknown'}"
    return f"{base_slug}@noemail.local"


class Command(BaseCommand):
    help = "Import attendees from XLSX/CSV, create users if not existing, and create attended registrations for event"

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            required=True,
            help="Path to the attendees file (.xlsx or .csv)",
        )
        parser.add_argument(
            "--event",
            type=int,
            default=4,
            help="Event ID to attach registrations to (default: 4)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Do not write anything to DB; just show what would happen.",
        )
        parser.add_argument(
            "--update-missing",
            action="store_true",
            help="If user exists, update blank fields (student_id/year/major/university) from sheet when missing.",
        )

    def handle(self, *args, **options):
        path = options["path"]
        event_id = options["event"]
        dry_run = options["dry_run"]
        update_missing = options["update_missing"]

        if not os.path.exists(path):
            raise CommandError(f"File not found: {path}")

        try:
            event = Event.objects.get(pk=event_id)
        except Event.DoesNotExist:
            raise CommandError(f"Event with id={event_id} does not exist.")

        # تلاش برای تشخیص فرمت فایل
        ext = os.path.splitext(path)[1].lower()
        rows = []

        # انتظار داریم ستون‌ها چیزی شبیه این باشند:
        # شماره | نام | نام‌خانوادگی | شماره تلفن | کد دانشجویی | دانشگاه | رشته | ورودی | (شاید) ایمیل | (شاید) تکمیل
        # هدرهای واقعی ممکن است کمی متفاوت باشند، برای همین سعی می‌کنیم با normalize پیدا کنیم.
        headers_map = {}

        def load_csv(p):
            with open(p, "r", encoding="utf-8-sig", newline="") as f:
                reader = csv.reader(f)
                data = list(reader)
            return data

        def load_xlsx(p):
            if openpyxl is None:
                raise CommandError("openpyxl is not installed. Install it or use a CSV file.")
            wb = openpyxl.load_workbook(p)
            ws = wb.active
            data = []
            for row in ws.iter_rows(values_only=True):
                data.append([None if c is None else str(c) for c in row])
            return data

        if ext == ".csv":
            data = load_csv(path)
        elif ext in (".xlsx", ".xlsm", ".xltx", ".xltm"):
            data = load_xlsx(path)
        else:
            raise CommandError("Unsupported file extension. Use .xlsx or .csv")

        if not data:
            self.stdout.write(self.style.WARNING("No data found in the file."))
            return

        header = [normalize(h) for h in data[0]]
        # بسازیم نقشه‌ی ستون‌ها به کلیدهای مورد نیاز
        # کلیدهای هدف ما:
        # first_name, last_name, phone, student_id, university_label, major_label, year_of_study, email?
        expected_keys = {
            "first_name": {"نام"},
            "last_name": {"نام خانوادگی", "نام‌خانوادگی"},
            "phone": {"شماره تلفن", "تلفن", "موبایل"},
            "student_id": {"کد دانشجویی", "شماره دانشجویی"},
            "university_label": {"دانشگاه"},
            "major_label": {"رشته"},
            "year_of_study": {"ورودی", "سال ورود"},
            "email": {"ایمیل", "email"},
        }

        for idx, col_name in enumerate(header):
            if not col_name:
                continue
            for key, candidates in expected_keys.items():
                if col_name in candidates and key not in headers_map:
                    headers_map[key] = idx

        # حداقل نام و نام‌خانوادگی لازم است
        if "first_name" not in headers_map or "last_name" not in headers_map:
            raise CommandError("Cannot find 'نام' or 'نام خانوادگی' columns in header.")

        # نقشه‌ی label -> code برای دانشگاه‌ها
        uni_map = build_university_label_to_code()

        created_users = 0
        reused_users = 0
        created_regs = 0
        reused_regs = 0
        updated_users = 0
        skipped_rows = 0

        @transaction.atomic
        def do_import():
            nonlocal created_users, reused_users, created_regs, reused_regs, updated_users, skipped_rows

            for i, row in enumerate(data[1:], start=2):  # از ردیف دوم (بعد از هدر)
                try:
                    get = lambda key: normalize(row[headers_map[key]]) if key in headers_map and headers_map[key] < len(row) else None

                    first_name = get("first_name")
                    last_name = get("last_name")
                    phone = get("phone")
                    student_id = get("student_id")
                    university_label = get("university_label")
                    major_label = get("major_label")
                    year_str = get("year_of_study")
                    email = get("email")

                    if not first_name and not last_name:
                        continue  # ردیف خالی

                    # سال
                    year_of_study = None
                    if year_str:
                        # فقط رقم‌های ASCII
                        year_of_study = "".join(ch for ch in year_str if ch.isdigit())
                        year_of_study = int(year_of_study) if year_of_study else None

                    # major/university -> code
                    major_code = major_to_code(major_label)
                    university_code = university_to_code(university_label, uni_map)

                    # 1) ایمیل اگر نبود، placeholder بساز (بدون +2)
                    if not email:
                        email = make_placeholder_email(student_id, first_name, last_name)

                    # 2) دنبال کاربر موجود بگرد:
                    #   - اول با ایمیل (case-insensitive)
                    #   - اگر پیدا نشد و student_id داریم، با student_id هم تست کن
                    user = None
                    if email:
                        user = User.objects.filter(email__iexact=email).first()
                    if not user and student_id:
                        user = User.objects.filter(student_id=student_id).first()

                    if user:
                        reused_users += 1
                        if update_missing:
                            changed = False
                            if not user.student_id and student_id:
                                user.student_id = student_id; changed = True
                            if (user.year_of_study is None) and (year_of_study is not None):
                                user.year_of_study = year_of_study; changed = True
                            if not user.major and major_code:
                                user.major = major_code; changed = True
                            if not user.university and university_code:
                                user.university = university_code; changed = True
                            if changed:
                                user.save(update_fields=["student_id", "year_of_study", "major", "university"])
                                updated_users += 1
                    else:
                        # اگر نمی‌خوای اصلاً کاربر جدید بسازی، از فلگ --no-create استفاده کن
                        if options.get("no_create"):
                            skipped_rows += 1
                            self.stderr.write(f"[Row {i}] skipped: user not found and --no-create is set (email={email})")
                            continue

                        # ساخت کاربر جدید (بدون +۲ کردن ایمیل)
                        base_username = None
                        if student_id:
                            base_username = f"u{''.join(ch for ch in student_id if ch.isdigit())}" or None
                        if not base_username:
                            base_username = f"imported-{slugify((first_name or '') + '-' + (last_name or '')) or 'user'}"
                        username = ensure_unique_username(base_username)

                        user = User(
                            username=username,
                            email=email,  # همینی که هست؛ بدون +۲
                            first_name=first_name or "",
                            last_name=last_name or "",
                            student_id=student_id or None,
                            year_of_study=year_of_study,
                            major=major_code,
                            university=university_code,
                            is_email_verified=False,
                            is_active=True,
                        )
                        user.set_password("ShouldChange")
                        user.save()
                        created_users += 1

                    # 3) ساخت/به‌روزرسانی ثبت‌نام به حالت attended
                    reg, created = Registration.objects.get_or_create(
                        event=event, user=user, defaults={"status": Registration.StatusChoices.ATTENDED}
                    )
                    if created:
                        created_regs += 1
                    else:
                        if reg.status != Registration.StatusChoices.ATTENDED:
                            reg.status = Registration.StatusChoices.ATTENDED
                            reg.save(update_fields=["status"])
                        reused_regs += 1


                except Exception as e:
                    skipped_rows += 1
                    # برای دیباگ:
                    self.stderr.write(f"[Row {i}] skipped due to error: {e}")

            if dry_run:
                self.stdout.write(self.style.WARNING("Dry-run active; rolling back all changes."))
                raise transaction.TransactionManagementError("DRY_RUN")

        try:
            do_import()
        except transaction.TransactionManagementError as e:
            if "DRY_RUN" not in str(e):
                raise

        self.stdout.write(self.style.SUCCESS("Done."))
        self.stdout.write(f"Users created:   {created_users}")
        self.stdout.write(f"Users reused:    {reused_users}")
        self.stdout.write(f"Users updated:   {updated_users} (only when --update-missing)")
        self.stdout.write(f"Regs created:    {created_regs}")
        self.stdout.write(f"Regs reused/upd: {reused_regs}")
        if skipped_rows:
            self.stdout.write(self.style.WARNING(f"Rows skipped:    {skipped_rows}"))
