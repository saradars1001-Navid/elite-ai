# استقرار واقعی Elite AI Academy با Laravel و MySQL

## معماری

- `backend/` یک API مستقل Laravel 11 است.
- احراز هویت با OTP پیامکی و Laravel Sanctum انجام می‌شود؛ کد OTP فقط hash شده در دیتابیس ذخیره می‌شود.
- محتوای فصل‌ها، درس‌ها، ابزارها، کوییزها، کاربران، کامیونیتی، ویدئوهای کوتاه و پرامپت‌های ترند در MySQL هستند.
- امتیاز کوییز و XP در تراکنش سرور محاسبه می‌شود؛ مقدار ارسالی کلاینت برای امتیاز معتبر نیست.
- جست‌وجوی عمومی از `/search` و جست‌وجوی بازیکنان واقعی از `/users/search` خوانده می‌شود.
- پنل ادمین به مسیرهای admin با Bearer Token و نقش `admin` محدود است.
- فرانت‌اند وقتی `VITE_API_BASE_URL` تنظیم شود از Laravel استفاده می‌کند؛ اگر تنظیم نشده باشد فقط برای توسعه fallback محلی فعال می‌ماند.

## نصب روی هاست اشتراکی

1. PHP 8.2 یا بالاتر و افزونه‌های `pdo_mysql`, `mbstring`, `openssl`, `fileinfo` را فعال کنید.
2. یک دیتابیس MySQL و کاربر محدود به همان دیتابیس بسازید.
3. پوشه `backend` را خارج از `public_html` آپلود کنید و Document Root دامنه API را روی `backend/public` بگذارید. اگر هاست اجازه تغییر Document Root نمی‌دهد، فقط محتویات `backend/public` را داخل `public_html` قرار دهید و مسیر `../vendor` و `../bootstrap` در `index.php` را مطابق محل واقعی اصلاح کنید.
4. در پوشه `backend` اجرا کنید:

```bash
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force
node scripts/export-content.mjs      # در ریشه پروژه — محتوای همراه اپ را به JSON می‌ریزد
php artisan academy:import           # فصل‌ها، درس‌ها، کوییزها، آزمون‌ها، ابزارها، ویدئوها، پرامپت‌ها و کامیونیتی
php artisan academy:make-admin 09121234567   # ساخت/ارتقای حساب مدیر
php artisan config:cache
php artisan route:cache
```

5. `storage` و `bootstrap/cache` باید writable باشند (با `chmod -R 775 storage bootstrap/cache`). `APP_DEBUG=false` و HTTPS الزامی است.
   5b. **زمان‌بند (Scheduler):** برای اجرای jobهای زمان‌بندی‌شده (پاک‌سازی اعلان‌ها و…) یک cron در cPanel/هاست اضافه کنید (هر دقیقه — خود لاراول فقط کارهای موعد را اجرا می‌کند):

```cron
* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1
```

6. در Twilio یک شماره ارسال‌کننده فعال کنید و `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` را فقط در `backend/.env` وارد کنید. در production، `OTP_TEST_MODE=false` بماند.
7. برای فرانت‌اند، در `.env` ریشه پروژه مقدار زیر را بگذارید و build بگیرید:

```env
VITE_API_BASE_URL=https://api.example.com/api/v1
```

سپس خروجی `dist/` را روی دامنه وب اپ آپلود کنید. هیچ‌کدام از `APP_KEY`، رمز MySQL، کلید Twilio یا توکن سرویس در Vite قرار نمی‌گیرند.

## کارهای زمان‌بندی‌شده

- **`notifications:prune`** (`app/Console/Commands/PruneOldNotifications.php`) — هر روز ساعت ۰۳:۰۰ (`->dailyAt('03:00')` با `withoutOverlapping` در `bootstrap/app.php` با `withSchedule`) اعلان‌های **خوانده‌نشده قدیمی‌تر از ۹۰ روز** را حذف می‌کند؛ اعلان‌های خوانده‌شده (تاریخچه و رسیدها) و اعلان‌های جدید همیشه حفظ می‌شوند. پنجره نگهداری با `--days=` قابل تغییر است (مثلاً `php artisan notifications:prune --days=30`). تست: `PruneNotificationsTest` (پاک‌سازی فقط خوانده‌نشده‌های قدیمی، پنجره سفارشی، و idempotency).

- **ارسال گروهی/عمومی** — `NotificationService::broadcast()` با bulk-insert در chunkهای ۵۰۰تایی برای هر کاربر فعال غیرادمین یک ردیف می‌سازد (اسکوپ مخاطب با closure روی کوئری). SMS برای اعلان گروهی همگام ارسال نمی‌شود — پیامک انبوه باید از job صف‌بندی‌شده برود (پرچم `$sms` فقط برای مخاطب کوچک). تست: `NotificationBroadcastTest` (همه کاربران به‌جز ادمین/بلاک، مخاطب خریداران فصل/فعال ۳۰ روز/بدون خرید، ۴۰۳ برای غیرادمین، اعتبارسنجی، صفر دریافت‌کننده).

## APIهای متصل‌شده به فرانت‌اند

- `POST /api/v1/auth/otp/request`
- `POST /api/v1/auth/otp/verify`
- `GET /api/v1/me`
- `GET /api/v1/catalog`
- `GET /api/v1/discovery`
- `GET /api/v1/search?q=...`
- `GET /api/v1/leaderboard`
- `GET /api/v1/users/search?q=...` با احراز هویت
- `GET /api/v1/quizzes/{id}`
- `POST /api/v1/quizzes/{id}/attempts` با محاسبه نمره در سرور
- `GET /api/v1/quizzes/{id}/leaderboard`
- `POST /api/v1/live-matches` (ایجاد مسابقه زنده)
- `GET /api/v1/live-matches/lobby` (لیست مسابقه‌های در انتظار)
- `POST /api/v1/live-matches/{id}/join` و `POST /api/v1/live-matches/{id}/start`
- `POST /api/v1/live-matches/{id}/rematch` (بازی دوباره: فقط میزبان، فقط بعد از پایان — سؤال‌های تازه + صفر شدن امتیازها)
- `GET /api/v1/live-matches/{id}` و `POST /api/v1/live-matches/{id}/answer`
- `GET/POST /api/v1/community/posts`
- `POST /api/v1/checkout` (ایجاد سفارش + URL درگاه)
- `GET /api/v1/checkout/{id}` (وضعیت سفارش)
- `POST /api/v1/checkout/{id}/refund` (بازگشت وجه — فقط ادمین)
- `GET /api/v1/payment/callback` (عمومی — برگشت درگاه به سرور)
- `POST /api/v1/payment/webhook` (عمومی — وب‌هوک سرور-به-سرور پرداخت/بازگشت وجه)
- `GET /api/v1/wallet` (موجودی و تراکنش‌های کیف پول)
- `POST /api/v1/wallet/charge` (شارژ کیف پول از درگاه)
- `GET /api/v1/wallet/callback` (عمومی — برگشت درگاه برای شارژ)
- `GET /api/v1/admin/stats` (فروش، پیشرفت کاربران و عملکرد کوییزها — فقط ادمین)
- `GET /api/v1/admin/payment-events` (لاگ وب‌هوک‌ها و callbackهای درگاه — فقط ادمین)
- `POST /api/v1/admin/notifications` — **ارسال اعلان عمومی/گروهی** (فقط ادمین): برای هر کاربر فعال غیرادمین یک ردیف در `user_notifications` می‌سازد و تعداد واقعی دریافت‌کنندگان را برمی‌گرداند. مخاطب: `all` (همه فعال)، `chapter-buyers` (+`chapterId` — دارندگان خرید موفق آن فصل)، `active-30d` (فعال در ۳۰ روز اخیر)، `no-purchase` (بدون هیچ خرید موفق). ادمین‌ها و کاربران بلاک‌شده هرگز اعلان نمی‌گیرند. در پنل ادمین: `/admin/notifications`
- `POST /api/v1/admin/pricing/preview` — **شبیه‌ساز قیمت‌گذاری** (فقط ادمین): با `chapterId`، نمره آزمون فرضی (`examScore`) و کد کوپن (`couponCode`) قیمت نهایی را بدون ساخت سفارش محاسبه می‌کند — قیمت پایه، درصد عملکردی از `discount_rules`، درصد کوپن، جمع تخفیف، برچسب و جدول tiers. تخفیف عملکردی فقط وقتی فصل قبلی وجود داشته باشد اعمال می‌شود. صفحه آن در پنل ادمین: `/admin/pricing`
- `GET /api/v1/notifications` (اعلان‌های کاربر + شمارنده خوانده‌نشده)
- `PATCH /api/v1/notifications/read-all` (علامت‌گذاری همه به‌عنوان خوانده‌شده)
- `PATCH /api/v1/notifications/{id}/read` (خواندن یک اعلان — فقط صاحب آن)
- `DELETE /api/v1/notifications/{id}` (حذف اعلان — فقط صاحب آن)
- `GET/PATCH /api/v1/admin/users`
- `POST/DELETE /api/v1/admin/resources/{resource}`

## ورود ادمین

هیچ کاربر تستی در Seeder ساخته نمی‌شود. اولین مدیر باید مستقیماً پس از اولین ورود OTP با یک migration/command امن به role `admin` ارتقا داده شود؛ این کار را از طریق SQL عمومی یا فرم بدون محافظ انجام ندهید. برای راه‌اندازی اولیه می‌توانید در محیط production پس از ورود اولین شماره، با دسترسی محدود دیتابیس این دستور را اجرا کنید:

```sql
UPDATE users SET role = 'admin' WHERE phone = '+989121234567';
```

شماره را با فرمت ذخیره‌شده واقعی جایگزین کنید و بلافاصله دسترسی SQL را ببندید.

## مسابقه زنده (بدون شبیه‌سازی bots)

- جدول‌های `live_matches` و `live_match_players` در migration دوم ایجاد می‌شوند.
- کاربر با «ایجاد مسابقه» میزبان می‌شود و دیگران از lobby به مسابقه در انتظار می‌پیوندند؛ هیچ بازیکن جعلی ساخته نمی‌شود.
- سؤالات از کوییزهای منتشرشده دیتابیس انتخاب می‌شوند و امتیاز + جایزه سرعت در سرور محاسبه می‌شود.
- پیشرفت سؤال‌ها با poll فرانت‌اند (هر ۱٫۴ ثانیه) همگام می‌شود؛ سؤال بی‌پاسخ با انقضای زمان در سرور غلط ثبت می‌شود تا مسابقه هرگز قفل نشود.
- در پایان، رتبه‌بندی نهایی در تراکنش ذخیره و XP متناسب با مقام به هر بازیکن تعلق می‌گیرد.
- اگر `VITE_API_BASE_URL` تنظیم نشده باشد، همین صفحه برای توسعه محلی از شبیه‌سازی bots استفاده می‌کند.

## خرید فصل و درگاه پرداخت

- قیمت هرگز از کلاینت پذیرفته نمی‌شود؛ `POST /api/v1/checkout` قیمت نهایی را در سرور از `price` فصل، تخفیف عملکردی (`discount_rules` بر اساس بهترین نمره آزمون فصل قبل) و کوپن (`coupons`) محاسبه می‌کند.
- سفارش ابتدا با وضعیت `pending` و `checkout_id` یکتا ثبت می‌شود و `payment/callback` باید به سرور برگردد (نه مستقیم به SPA).
- درگاه‌های پشتیبانی‌شده: **زرین‌پال** (`ZarinpalGateway`) و **آیدی‌پی** (`IDPayGateway`)، هر دو پیاده‌ساز اینترفیس `PaymentGateway` هستند. انتخاب با متغیر `PAYMENT_GATEWAY=zarinpal|idpay` انجام می‌شود؛ برای درگاه جدید فقط یک کلاس پیاده‌سازی و یک case در `PaymentService` اضافه کنید.
- callback مستقل از درگاه است: هر درگاه پارامترهای برگشتی خودش (زرین‌پال: `Status/Authority`، آیدی‌پی: `status/track_id/id`) را با `verifyFromCallback` می‌خواند و سپس `verify` با مبلغ و orderId سمت سرور اجرا می‌شود.
- پس از بازگشت درگاه، سرور تراکنش را با `verify` تأیید می‌کند، سفارش را `paid` می‌کند، رسید تولید می‌شود و دسترسی فصل به‌صورت خودکار از روی خریدهای موفق فعال می‌شود.
- بازگشت وجه فقط برای ادمین: تراکنش در درگاه refund می‌شود و سفارش `refunded` می‌شود.
- متغیرهای لازم در `backend/.env`:

```env
PAYMENT_GATEWAY=zarinpal
ZARINPAL_MERCHANT_ID=
ZARINPAL_SANDBOX=true
IDPAY_API_KEY=
IDPAY_SANDBOX=true
APP_URL=https://api.example.com
FRONTEND_URL=https://app.example.com
```

برای آیدی‌پی: `PAYMENT_GATEWAY=idpay` و فقط `IDPAY_API_KEY` را پر کنید. بازگشت وجه آیدی‌پی در نسخه 1.1 از پنل انجام می‌شود (API عمومی ندارد)؛ در آن حالت ادمین سفارش را به‌صورت دستی `refunded` می‌کند.

- برای کوپن‌ها و قوانین تخفیف، جدول‌های `coupons` و `discount_rules` با migration سوم (`2026_08_08_000002_create_payments`) ساخته می‌شوند. برای ساخت کوپن اولیه:

```sql
INSERT INTO coupons (code, percent, max_uses, used_count, active, created_at, updated_at)
VALUES ('ELITE10', 10, 100, 0, 1, NOW(), NOW());
```

## آمار داشبورد ادمین

- `GET /api/v1/admin/stats` سه گروه آماری واقعی از MySQL برمی‌گرداند:
  - **sales**: درآمد موفق، تعداد سفارش‌ها به تفکیک وضعیت، میانگین سفارش، فروش روزانه ۱۴ روز اخیر و آخرین پرداخت‌ها.
  - **progress**: کاربران فعال، ثبت‌نام ۳۰ روز اخیر، درس‌های تکمیل‌شده، یادگیرندگان متمایز، نرخ تکمیل هر فصل (از `lesson_progress`) و یادگیرندگان برتر بر اساس XP.
  - **quizzes**: تعداد تلاش، میانگین نمره، نرخ قبولی (۷۰٪+)، آمار هر کوییز، روند روزانه و برترین‌های کوییز.
- داشبورد ادمین در حالت Laravel این اعداد را نمایش می‌دهد؛ در حالت توسعه بدون API از داده محلی fallback استفاده می‌کند.
- migration چهارم (`2026_08_08_000003_create_exam_attempts`) جدول `exam_attempts` را می‌سازد که هم برای تخفیف عملکردی خرید (نمره بهترین آزمون فصل قبل) و هم آمار پیشرفت لازم است.

## وب‌هوک سرور-به-سرور (payment/webhook)

- `POST /api/v1/payment/webhook` اعلان‌های درگاه را بدون توکن کاربر (عمومی) دریافت می‌کند؛ امنیت به سه لایه است:
  1. اگر `PAYMENT_WEBHOOK_SECRET` تنظیم شده باشد، هدر `X-Webhook-Secret` باید با آن برابر باشد.
  2. **تأیید امضای HMAC** (درگاه‌های Zibal-style که وب‌هوک را امضا می‌کنند): هر درگاه با `verifyWebhookSignature` امضا را روی بدنه خام بررسی می‌کند — `hash_hmac(algo, rawBody, secret)`. متغیرها: `WEBHOOK_HMAC_SECRET`, `WEBHOOK_HMAC_HEADER` (پیش‌فرض `X-Signature`), `WEBHOOK_HMAC_ALGO` (پیش‌فرض `sha256`) و برای آیدی‌پی به‌صورت اختصاصی `IDPAY_WEBHOOK_SECRET`. اگر راز تنظیم نشده باشد این لایه رد می‌شود (درگاه‌های بدون امضا با لایه ۳ امن می‌مانند).
  3. مهم‌تر: برای اعلان موفق، تراکنش دوباره با API درگاه (`verify`) به‌صورت سرور-به-سرور تأیید می‌شود — وب‌هوک جعلی بدون تراکنش واقعی هرگز موفق نمی‌شود.
- `referenceId` در اعلان مشخص می‌کند که موضوع خرید فصل است (`purchase_id`) یا شارژ کیف پول (`wallet-{id}`).
- رویدادهای پشتیبانی‌شده: `payment/paid` (فعال‌سازی دسترسی یا اعتبار کیف پول)، `payment/failed` و `refund` (بازگشت وجه از سمت درگاه).
- ایدمپوتنت است: تکرار یک اعلان تغییری ایجاد نمی‌کند و همان پاسخ موفق برمی‌گردد.
- زرین‌پال v4 وب‌هوک ندارد (فقط callback) — درخواست وب‌هوک با `ignored: true` پاسخ داده می‌شود. آیدی‌پی اعلان POST را با فیلدهای `id/order_id/track_id/status` ارسال می‌کند.
- URL موردنیاز برای تنظیم در پنل درگاه: `https://api.example.com/api/v1/payment/webhook`

## لاگ رویدادهای پرداخت (پنل ادمین)

- جدول `payment_events` (migration ششم) هر اعلان دریافتی از درگاه را ثبت می‌کند: منبع (وب‌هوک/callback)، درگاه، نوع (پرداخت/بازگشت)، مرجع (خرید یا کیف پول)، وضعیت نهایی، payload کامل، نتیجه verify و خطا.
- ثبت در هر سه نقطه انجام می‌شود: `PaymentWebhookController`، callback خرید (`CheckoutController`) و callback شارژ کیف پول (`WalletController`) — حتی درخواست‌های ردشده (بدون امضا، مرجع نامعتبر، verify ناموفق) هم برای بازبینی حملات ثبت می‌شوند.
- وضعیت‌ها: `received` (دریافت)، `processed` (پردازش شد)، `idempotent` (تکراری/بی‌اثر)، `ignored` (درگاه بدون وب‌هوک)، `failed` (رد/خطا).
- خرابی خود لاگ هرگز جریان پرداخت را متوقف نمی‌کند (خطاها فقط در لاگ اپ نوشته می‌شوند).
- بازبینی: تب «رویدادهای پرداخت» در `GET /api/v1/admin/payment-events` (۱۰۰ رویداد آخر با فیلتر وضعیت/منبع) — payload و نتیجه verify به‌صورت expandable نمایش داده می‌شود.

## کیف پول

- ستون `wallet_balance` روی جدول `users` و جدول `wallet_transactions` با migration پنجم (`2026_08_08_000004_create_wallet`) ساخته می‌شوند؛ دفترچه تراکنش همیشه تراز است (`balance_after`).
- **شارژ**: `POST /api/v1/wallet/charge` یک تراکنش pending می‌سازد، درگاه را باز می‌کند و پس از برگشت در `wallet/callback` (verify سمت سرور) موجودی داخل یک تراکنش دیتابیس اعتبار می‌شود.
- **خرید با کیف پول**: `POST /api/v1/checkout` با `paymentMethod: "wallet"` — موجودی سمت سرور بررسی می‌شود؛ اگر کافی نبود ۴۲۲ برمی‌گردد. در صورت کافی‌بودن، کسر موجودی + ثبت خرید موفق + ردیف `purchase` در دفترچه، همه داخل یک تراکنش دیتابیس انجام می‌شود.
- **تاریخچه**: `GET /api/v1/wallet` آخرین ۵۰ تراکنش (شارژ/خرید/بازگشت/هدیه) را با موجودی پس از هر تراکنش برمی‌گرداند و صفحه پروفایل نمایش می‌دهد.
- محدودیت مبلغ شارژ: ۱۰٬۰۰۰ تا ۵۰٬۰۰۰٬۰۰۰ تومان.
- در حالت بدون API (توسعه)، کیف پول به‌صورت محلی شبیه‌سازی می‌شود: شارژ موفق فرضی و خرید با کسر موجودی.

## تست‌ها

زیرساخت تست با PHPUnit 11 و SQLite درون‌حافظه آماده است (`phpunit.xml` + `tests/`). اجرا:

```bash
php artisan test
# یا
vendor/bin/phpunit
```

تست‌های فعلی (**۱۰۹ تست / ۴۶۸ assertion** — همه فایل‌های `tests/Feature/`):

**`PaymentWebhookTest.php` — امنیت وب‌هوک** با `Http::fake`:

- **وب‌هوک جعلی رد می‌شود** — اعلان موفق بدون تراکنش واقعی در درگاه (verify API خطا برمی‌گرداند) → ۴۲۲ و سفارش `pending` می‌ماند.
- **اعلان معتبر پذیرفته می‌شود** — verify موفق → سفارش `paid` و مرجع تراکنش ذخیره می‌شود.
- **تکرار اعلان ایدمپوتنت است** — ارسال مجدد همان اعلان تغییری در وضعیت/رسید ایجاد نمی‌کند.

**`PaymentFlowTest.php` — جریان کامل پرداخت** (callback هر دو درگاه + کیف پول):

- **Callback زرین‌پال** — موفق (verify کد ۱۰۰ → `paid` + رسید + ایدمپوتنسی)، ناموفق (verify رد → `failed`)، و انصراف (`Status=NOK` → بدون تماس HTTP با درگاه).
- **Callback آیدی‌پی** — موفق و ناموفق برای خرید فصل.
- **شارژ کیف پول** — شروع شارژ (سفارش `pending` + URL درگاه)، اعتباردهی موجودی پس از callback موفق، تکرار callback بدون دوبرابر شدن موجودی، و رد در صورت ناموفق بودن verify.
- **خرید با کیف پول** — کسر موجودی + ثبت تراکنش دفترچه، **موجودی ناکافی → ۴۲۲** بدون تغییر، و خرید با موجودی دقیق.

**`RefundTest.php` — بازگشت وجه ادمین** (`POST /checkout/{purchase}/refund`):

- **درگاه موفق** — API درگاه کد ۱۰۰ برگرداند → سفارش `refunded` + `refunded_at` + اعلان «بازگشت وجه» برای خریدار.
- **بدون مرجع درگاه** (خرید با کیف پول) — بدون تماس HTTP با درگاه (`assertNothingSent`) مسترد می‌شود.
- **درگاه ناموفق** — کد غیر ۱۰۰ → ۵۰۲ با پیام فارسی، سفارش `paid` می‌ماند و اعلانی ثبت نمی‌شود.
- **غیرمجاز** — کاربر عادی → ۴۰۳؛ سفارش `pending` → ۴۲۲ «فقط خرید موفق قابل بازگشت است»؛ سفارش قبلاً مستردشده → ۴۲۲ «این خرید قبلاً مسترد شده است».

**`RefundRequestTest.php` — درخواست بازگشت وجه توسط کاربر** (`POST /checkout/{purchase}/refund-request` + `GET /admin/refunds` + approve/reject):

- **درخواست کاربر** — خریدار روی خرید موفق خود دلیل ثبت می‌کند → `refund_requested_at` ست می‌شود، وضعیت `paid` (دسترسی) حفظ می‌شود و `refundStatus = pending` برمی‌گردد.
- **دسترسی** — کاربر دیگر → ۴۰۳؛ درخواست تکراری در حالت pending → ۴۰۹؛ خرید `pending`/`refunded` قابل درخواست نیست (۴۲۲).
- **لیست ادمین** — `GET /admin/refunds?status=pending|done` با نام کاربر، فصل، رسید، دلیل و زمان درخواست.
- **تأیید** — درگاه کد ۱۰۰ → سفارش `refunded` + اعلان «بازگشت وجه تأیید شد»؛ درگاه ناموفق → ۵۰۲ و درخواست همچنان pending می‌ماند.
- **رد** — `refund_rejected_at` ست می‌شود، سفارش `paid` می‌ماند (بدون تماس با درگاه) و اعلان «درخواست بازگشت وجه رد شد» ثبت می‌شود.

**اندپوینت‌های جدید:**

- `POST /api/v1/checkout/{purchase}/refund-request` — درخواست بازگشت وجه توسط خریدار (auth).
- `GET /api/v1/admin/refunds?status=pending|done` — لیست درخواست‌ها (فقط ادمین).
- `POST /api/v1/admin/refunds/{purchase}/approve` — تأیید و بازگشت وجه در درگاه (فقط ادمین).
- `POST /api/v1/admin/refunds/{purchase}/reject` — رد درخواست و حفظ دسترسی (فقط ادمین).

**`PricingTest.php` — قیمت‌گذاری سمت سرور** (کوپن + تخفیف عملکردی):

- **قیمت پایه** بدون تخفیف → `price` برابر `base_price`، بدون برچسب.
- **کوپن** → قیمت نهایی دقیق (۱۰٪ تخفیف)، ذخیره `coupon_code` و برچسب، کسر دقیق از کیف پول و **افزایش `used_count` کوپن**.
- **تخفیف عملکردی** — بهترین نمره آزمون فصل قبل: ۹۵ → ۳۰٪، ۸۵ → ۲۰٪؛ بدون آزمون → بدون تخفیف.
- **ترکیب کوپن + عملکردی** — ۲۰٪ + ۱۰٪ = ۳۰٪ روی قیمت پایه.
- **کوپن نامعتبر** — منقضی، مصرف‌شده (max_uses) یا کد ناشناخته → نادیده گرفته می‌شود و قیمت کامل می‌ماند.
- **تخفیف ۱۰۰٪** → خرید رایگان (`FREE-`) بدون تماس با درگاه و بدون کسر کیف پول، با شمارش مصرف کوپن.

**`NotificationTest.php` — اعلان‌ها** — تولید اعلان «پرداخت موفق» بعد از پرداخت، لیست + خواندن + read-all، عدم دسترسی به اعلان کاربر دیگر (۴۰۳) و حذف اعلان.

**تست‌های پوشش کنترلرهای اصلی** (برای رساندن پوشش به بالای ۸۰٪):

- **`AuthTest.php`** — OTP: درخواست کد (شماره نامعتبر ۴۲۲، تولید کد نرمال‌شده، باطل‌کردن کد قبلی، ۵۰۳ وقتی پیامک پیکربندی نشده)، تأیید کد (ساخت کاربر + توکن، نام پیش‌فرض، کد غلط → افزایش attempts، ۵ تلاش → رد، کاربر مسدود → ۴۰۳، به‌روزرسانی نام)، `me` و `logout`.
- **`CatalogTest.php`** — کاتالوگ عمومی: حذف محتوای پولی برای مهمان (content/captions/video پاک می‌شود)، نمایش کامل برای خریدار/ادمین/فصل رایگان، دیسکاوری (فقط منتشرشده)، و جستجوی سراسری (فصل/درس/ابزار/پست).
- **`CommunityTest.php`** — لیست پست‌های باز با صفحه‌بندی (و کران perPage)، ساخت پست با نویسنده، اعتبارسنجی و جزئیات پست.
- **`QuizTest.php`** — نمایش کوییز منتشرشده/پیش‌نویس (۴۰۴)، امتیازدهی سمت سرور + XP/امتیاز، و لیدربورد بر اساس بهترین نمره هر کاربر.
- **`UserLeaderboardTest.php`** — جستجوی کاربران واقعی (صف مسابقه)، لیدربورد سراسری XP، لیست دسترسی فصل‌ها و به‌روزرسانی پروفایل.
- **`AdminTest.php`** — گارد ۴۰۳ ادمین، مدیریت کاربران (لیست/فیلتر/ساخت/ویرایش)، لاگ رویدادهای پرداخت، upsert/delete منابع (فصل/کوییز/ابزار) و اندپوینت آمار زنده (فروش، پیشرفت، کوییز).
- **`LiveMatchTest.php`** — چرخه کامل مسابقه زنده: ساخت از بانک سؤال، لابی، پیوستن (ظرفیت/تکرار/شروع خودکار)، شروع توسط میزبان، پاسخ با امتیاز سرعت، پایان با رتبه + XP، رتبه‌بندی قطعی در tie-breaking (امتیاز/تعداد درست/زمینه شروع)، rematch، رفتار مسابقه وقتی بازیکن میانه قطع می‌شود، و وقتی هر دو بازیکن از ابتدا ساکت می‌مانند — تنها انقضای تایمر سؤال‌ها مسابقه را به finished می‌رساند، نه اینکه بدون XP رها شود.
- **۱۸۵ تست / ۸۹۹ asserion** در کل (بعد از اضافه شدن تست timer-only-advance).

- **`PromptLabTest.php`** — لیست سناریوهای منتشرشده و امتیازدهی پرامپت با سقف maxScore و XP.
- **`ExamTest.php`** — آزمون پایان فصل (`POST /exams/{chapter}/submit`): تصحیح سمت سرور (نمره جعلی کلاینت نادیده گرفته می‌شود)، ذخیره `exam_attempts`، اعطای تخفیف عملکردی از `discount_rules` (tiers ۳۰/۲۰/۱۰)، اعلان «تخفیف عملکردی فعال شد» (درون‌برنامه‌ای + پیامک از NotificationService)، اعلان ساده برای قبولی/عدم‌قبولی بدون تخفیف، دسترسی فصل پولی (۴۰۳ بدون خرید، مجاز برای خریدار/ادمین)، فصل آخر بدون تخفیف، و اجرای کامل `db:seed` (۶ آزمون + ۴۸ سؤال).

این تست‌ها **سه باگ واقعی production** را هم لو دادند و رفع شد (در بخش‌های قبلی): ستون `quizzes.chapter_id` در eager load کاتالوگ (کرش `GET /catalog`)، `$data['name']` بدون کلید در OTP (۵۰۰ در ورود بدون نام) و **بلاک‌شدن همه کاربران تازه‌نصب** چون `firstOrCreate` پیش‌فرض‌های دیتابیس را در مدل بار نمی‌کند (`refresh()` اضافه شد)، و رابطه `players()` با FK اشتباه (`match_id` به‌جای `live_match_id` — کرش کل مسابقه زنده).

برای اجرای تست‌ها روی هاست: `composer install` (بخش require-dev شامل phpunit و mockery) و سپس `php artisan test`.

### آزمون پایان فصل + تخفیف عملکردی (سمت سرور)

- **مایگریشن `2026_08_08_000008_create_exams.php`** — جداول `exams` و `exam_questions` (سؤال‌های هر فصل با گزینه، پاسخ صحیح و موضوع) تا سرور بتواند آزمون را خودش تصحیح کند. کلاینت فقط ایندکس پاسخ‌ها را می‌فرستد — نمره، قبولی و تخفیف هرگز از کلاینت پذیرفته نمی‌شود.
- **`POST /api/v1/exams/{chapter}/submit`** (auth) — دسترسی فصل پولی از `purchases` بررسی می‌شود؛ نمره = درصد پاسخ صحیح، قبولی طبق `pass_score`، تخفیف = `DiscountRule::percentFor` فقط وقتی قبول شده و فصل بعدی وجود دارد. تلاش در `exam_attempts` ذخیره و XP اعطا می‌شود.
- **NotificationService** — بعد از هر آزمون: اگر تخفیف اعطا شده، اعلان «تخفیف عملکردی فعال شد» با درصد و نام فصل بعد (درون‌برنامه‌ای + پیامک Twilio در صورت فعال‌بودن `NOTIFY_SMS_ENABLED`)، وگرنه اعلان ساده نتیجه. پیامک همان متن «تخفیف ٪X برای فصل بعد فعال شد» را می‌فرستد.
- **Seeder** — `DatabaseSeeder` حالا برای هر ۶ فصل آزمون و ۴۸ سؤال (مطابق بانک سؤال SPA) می‌سازد؛ اگر فصل وجود نداشته باشد، ردیف پوسته آن را `firstOrCreate` می‌کند تا FK برقرار شود (ویرایش ادمین را بازنویسی نمی‌کند).
- **رفع باگ deployment:** `composer.json` نگاشت PSR-4 برای `Database\Seeders\` و `Database\Factories\` نداشت — یعنی `php artisan db:seed` روی هر هاست با خطای «Target class [DatabaseSeeder] does not exist» از کار می‌افتاد. اضافه شد (با `composer dump-autoload` اعمال می‌شود).
- **فرانت‌اند:** `backendSubmitExam` در حالت Laravel پاسخ‌ها را به سرور می‌فرستد (`laravelSubmitExam`) و نتیجه معتبر سرور (نمره/تخفیف) با تلاش محلی همگام می‌شود — اعلان و پیامک از سمت سرور ارسال می‌شود.

## پوشش کد (Code Coverage)

گزارش پوشش فقط روی کد `app/` محاسبه می‌شود (عنصر `<source>` در `phpunit.xml`) و در CI به حداقل **۸۰٪ پوشش خطوط** enforce می‌شود.

اجرای محلی (نیاز به xdebug یا pcov فعال):

```bash
cd backend
php -d xdebug.mode=coverage vendor/bin/phpunit --coverage-clover coverage/clover.xml --coverage-text
php scripts/check-coverage.php coverage/clover.xml 80
```

`scripts/check-coverage.php` گزارش clover را می‌خواند، درصد پوشش کلی را چاپ می‌کند، لیست ۱۰ فایل کم‌پوشش را برای اقدام نشان می‌دهد و خروجی غیرصفر (exit 1) برمی‌گرداند اگر پوشش زیر آستانه باشد؛ آستانه به‌عنوان آرگومان دوم قابل تغییر است.

## اعلان‌های درون‌برنامه‌ای و پیامکی

بعد از هر رویداد مهم پرداخت، سرویس `NotificationService` برای کاربر دو کانال فعال می‌کند:

1. **درون‌برنامه‌ای** — ردیف در جدول `user_notifications` (همیشه ثبت می‌شود و فرانت‌اند در صفحه «اعلان‌ها» و با شمارنده خوانده‌نشده نشانش می‌دهد).
2. **پیامک** (اختیاری) — اگر `NOTIFY_SMS_ENABLED=true` و Twilio پیکربندی شده باشد، پیام کوتاه فارسی از طریق همان حساب OTP ارسال می‌شود. شکست SMS هرگز جریان اصلی را نمی‌شکند (فقط لاگ می‌شود).

رویدادهای پوشش‌داده‌شده:

- تأیید پرداخت فصل (وب‌هوک یا callback درگاه) → «پرداخت موفق» با لینک فصل.
- شارژ کیف پول (وب‌هوک یا callback) → «کیف پول شارژ شد».
- بازگشت وجه فصل (وب‌هوک یا پنل ادمین) → «بازگشت وجه».
- بازگشت وجه شارژ کیف پول → «بازگشت وجه کیف پول».

```env
NOTIFY_SMS_ENABLED=false   # true = ارسال پیامک
```

اندپوینت‌های کاربر (auth:sanctum) در بالای همین بخش لیست شده‌اند؛ فرانت‌اند در حالت Laravel اعلان‌ها را از API می‌خواند و خواندن/حذف را همگام می‌کند.

## CI (GitHub Actions)

پایپ‌لاین `.github/workflows/backend.yml` بعد از هر push/PR که بک‌اند **یا فرانت‌اند** را لمس کند اجرا می‌شود و دو سمت را پوشش می‌دهد. یک job «changes» (با `dorny/paths-filter`) تشخیص می‌دهد کدام سمت تغییر کرده و فقط همان jobها اجرا می‌شوند؛ تغییر خود workflow هر دو را اجرا می‌کند.

**Job بک‌اند** (`lint-and-test` — روی PHP 8.2 و 8.3):

1. نصب وابستگی‌ها با `composer install` (با کش کامپوزر).
2. ساخت `.env` و تولید `APP_KEY`.
3. **لینت** — `vendor/bin/pint --test` (پیش‌تنظیم laravel؛ کل کدباز بک‌اند یک‌بار فرمت شده تا از روز اول سبز باشد).
4. **تست‌ها** — `vendor/bin/phpunit` روی هر دو نسخه PHP (SQLite درون‌حافظه، بدون نیاز به MySQL).
5. **پوشش کد (فقط PHP 8.2)** — xdebug فعال است (`coverage: xdebug`) و بعد از تست: `vendor/bin/phpunit --coverage-clover coverage/clover.xml --coverage-text` و سپس enforce با `php scripts/check-coverage.php coverage/clover.xml 80` — اگر پوشش زیر ۸۰٪ باشد بیلد شکست می‌خورد و لیست فایل‌های کم‌پوشش در لاگ نمایش داده می‌شود.

**Job فرانت‌اند** (`frontend` — روی Node 20):

1. **کش `node_modules`** با `actions/cache` (کلید بر اساس هش `package-lock.json`)؛ در صورت hit دقیق، نصب کاملاً رد می‌شود (`npm ci` فقط روی cache miss اجرا می‌شود چون خودش node_modules را پاک می‌کند). کش npm هم از `setup-node` فعال است.
2. `npm ci` (بر اساس `package-lock.json`).
3. **لینت** — `npm run lint` (ESLint 9 flat config با typescript-eslint + react-hooks + حذف خودکار importهای بلااستفاده) و `npm run format:check` (Prettier).
4. **Typecheck** — `npm run typecheck` (`tsc --noEmit`).
5. **Build** — `npm run build` (`tsc --noEmit && vite build`، شامل تولید PWA).

اجرای محلی همان مراحل:

```bash
cd backend
vendor/bin/pint --test      # لینت
vendor/bin/phpunit          # تست‌ها
# پوشش (با xdebug/pcov فعال):
php -d xdebug.mode=coverage vendor/bin/phpunit --coverage-clover coverage/clover.xml --coverage-text
php scripts/check-coverage.php coverage/clover.xml 80

cd ..
npm ci                       # نصب وابستگی‌های فرانت‌اند
npm run lint                 # لینت ESLint
npm run format:check         # بررسی فرمت Prettier
npm run typecheck            # تایپ‌چک
npm run build                # بیلد + PWA
```

تنظیمات لینت/فرمت: `eslint.config.js` (flat config — typescript-eslint، react-hooks، eslint-plugin-unused-imports و سازگاری با Prettier از طریق eslint-config-prettier)، `.prettierrc` (پرینت‌واید ۱۰۰، کوتیشن دابل، سمیکالن) و `.prettierignore`. یک‌بار فرمت‌دهی و پاک‌سازی اولیه کد انجام شده تا `lint` و `format:check` از روز اول سبز باشند؛ هشدارهای `react-hooks/exhaustive-deps` عمداً هشدار باقی مانده‌اند (بیلد را نمی‌شکنند).

نکته: متغیرهای تست (مانند `FRONTEND_URL` و `ZARINPAL_MERCHANT_ID`) در `phpunit.xml` تعریف شده‌اند؛ `bootstrap/providers.php` سرویس‌پروایدرها (از جمله `PaymentService`) را ثبت می‌کند — بدون آن، وابستگی درگاه در کنترلرها resolve نمی‌شود.

## اجرای محلی (XAMPP)

۱. Apache/MySQL را از کنترل‌پنل XAMPP بالا بیاورید و دیتابیس بسازید:

```sql
CREATE DATABASE elite_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

۲. `backend/.env` را از روی `backend/.env.example` بسازید (در حالت محلی `APP_ENV=local`,
`APP_DEBUG=true`, `APP_URL=http://127.0.0.1:8000`, `FRONTEND_URL=http://127.0.0.1:5173`,
`OTP_TEST_MODE=false`, `ZARINPAL_SANDBOX=true`) و سه مقدار Twilio
(`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`) را وارد کنید و سپس:

```bash
cd backend
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force
cd ..
node scripts/export-content.mjs
cd backend && php artisan academy:import && cd ..
php backend/artisan academy:make-admin 09121234567
```

۳. سرور API و فرانت‌اند را بالا بیاورید:

```bash
cd backend && php artisan serve --host=127.0.0.1 --port=8000   # ترمینال اول
npm run dev                                                     # ترمینال دوم
```

۴. در ریشه پروژه `.env.local` بسازید تا فرانت‌اند به همین API وصل شود (این فایل commit نمی‌شود):

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

تنظیم پیش‌فرض همین مخزن `OTP_TEST_MODE=false` است: کد ورود واقعاً از طریق Twilio ارسال می‌شود و
پاسخ `POST /auth/otp/request` فقط `ok` و `expiresIn` دارد. اگر Twilio پیکربندی نشده باشد، همین مسیر
به‌جای شکستن با `503` و پیام «ارسال پیامک انجام نشد» پاسخ می‌دهد و هیچ کدی در پاسخ نیست.

برای توسعهٔ بدون Twilio می‌توانید موقتاً `OTP_TEST_MODE=true` بگذارید (فقط با `APP_ENV=local`)؛ در آن
حالت پاسخ فیلد `debugCode` را هم برمی‌گرداند و صفحه ورود آن را زیر کادر کد نشان می‌دهد. این فیلد خارج
از `APP_ENV=local` هرگز ارسال نمی‌شود و با `OTP_TEST_MODE=false` اصلاً ساخته نمی‌شود.

> درگاه پرداخت محلی اعتبارنامه ندارد؛ برای تست مسیر خرید از «کیف پول» استفاده کنید یا
> `ZARINPAL_MERCHANT_ID`/`IDPAY_API_KEY` سندباکس را در `backend/.env` وارد کنید.

## نکته مهم درباره داده اولیه

Backend عمداً کاربر و leaderboard جعلی تولید نمی‌کند. محتوای آموزشی از بستهٔ فرانت‌اند استخراج و با
`php artisan academy:import` وارد می‌شود (`backend/database/academy-content.json`)؛ این دستور
idempotent است و پس از هر تغییر محتوا دوباره قابل اجراست. کاربران واقعی فقط با OTP ساخته می‌شوند و
نقش مدیر با `php artisan academy:make-admin <phone>` داده می‌شود. پیش از تنظیم `VITE_API_BASE_URL`،
فرانت برای توسعه از همان محتوای همراه اپ استفاده می‌کند؛ این fallback برای production نباید فعال باشد.
