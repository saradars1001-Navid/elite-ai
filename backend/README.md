# Elite AI Academy API (Laravel 11)

این پوشه بک‌اند واقعی پروژه است؛ کاربران، محتوای آموزشی، کوییز، جست‌وجوی کاربران، کامیونیتی، ابزارها و محتوای اکسپلور در MySQL ذخیره می‌شوند و داده جعلی کاربر در seed ساخته نمی‌شود.

## استقرار روی هاست اشتراکی

1. هاست باید PHP 8.2+، افزونه‌های `pdo_mysql`, `mbstring`, `openssl`, `fileinfo` و Composer داشته باشد.
2. محتوای این پوشه را خارج از `public_html` قرار دهید و فقط `backend/public` را به‌عنوان Document Root دامنه API تنظیم کنید. اگر تغییر Document Root ممکن نیست، محتوای `backend/public` را در `public_html` کپی کنید و مسیرهای `index.php` را مطابق محل جدید تنظیم کنید.
3. `composer install --no-dev --optimize-autoloader` را اجرا کنید.
4. فایل `.env.example` را به `.env` کپی کنید، `APP_KEY` بسازید و اطلاعات MySQL، دامنه فرانت و Twilio را وارد کنید.
5. `php artisan migrate --force` و سپس `php artisan db:seed --force` را اجرا کنید. بعد محتوای آموزشی را وارد کنید: در ریشه پروژه `node scripts/export-content.mjs` را بزنید و سپس `php artisan academy:import` (idempotent — هر بار پس از تغییر محتوا دوباره قابل اجراست). حساب مدیر را با `php artisan academy:make-admin 09121234567` بسازید.
6. دسترسی نوشتن `storage` و `bootstrap/cache` را فعال کنید.
7. در فرانت‌اند مقدار `VITE_API_BASE_URL=https://api.example.com/api/v1` را تنظیم و دوباره build بگیرید.

## قراردادهای اصلی

- `POST /auth/otp/request` با `{ phone }`
- `POST /auth/otp/verify` با `{ phone, code, name? }` → `{ token, user }`
- `GET /catalog`
- `GET /discovery`
- `GET /search?q=...`
- `GET /users/search?q=...` (نیازمند توکن؛ فقط کاربران واقعی دیتابیس)
- `GET /leaderboard` (نیازمند توکن)
- `GET /quizzes/{id}`
- `POST /quizzes/{id}/attempts` با `{ answers, durationSeconds }`
- `GET /quizzes/{id}/leaderboard`
- `GET /community/posts`
- `POST /community/posts`

## امنیت

کد OTP فقط به‌صورت hash ذخیره می‌شود، حداکثر ۵ تلاش دارد و در production بدون Twilio پاسخ موفق نمی‌دهد. امتیاز کوییز در سرور محاسبه و XP در تراکنش دیتابیس افزایش می‌یابد. مسیرهای admin به نقش `admin` محدود هستند. `APP_DEBUG=false` و HTTPS در production الزامی است.
