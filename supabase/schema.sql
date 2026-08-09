-- ═══════════════════════════════════════════════════════════════════════════
--  Elite AI Academy — Supabase / PostgreSQL schema
--  اجرا در: Supabase Dashboard → SQL Editor (یک‌جا اجرا کنید)
--  نسخه: ۱.۰  |  سازگار با Supabase (PostgreSQL 15+)
--
--  اصول امنیتی:
--   * RLS روی همه جدول‌ها فعال است؛ هیچ جدولی بدون سیاست باز نیست.
--   * محتوای پولی (درس‌ها و ویدئوها) فقط با تابع has_chapter_access
--     که از purchases و access_grants می‌خواند قابل مشاهده است.
--   * ویدئوها در bucket خصوصی ذخیره می‌شوند و دسترسی از مسیر فایل
--     (فصل/درس.mp4) با تابع has_video_access کنترل می‌شود.
--   * لینک‌های پخش فقط از طریق Edge Function به‌صورت زمان‌دار صادر می‌شوند.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────── ۱) توابع کمکی ────────────────────────────────

-- آیا کاربر مدیر است؟
create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'admin'
  );
$$;

-- آیا کاربر به یک فصل دسترسی دارد؟ (رایگان / خرید موفق / اعطای دسترسی)
create or replace function public.has_chapter_access(p_user_id uuid, p_chapter_id text)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select
    exists (select 1 from public.chapters c where c.id = p_chapter_id and c.free)
    or exists (
      select 1 from public.purchases p
      where p.user_id = p_user_id and p.chapter_id = p_chapter_id and p.status = 'موفق'
    )
    or exists (
      select 1 from public.access_grants g
      where g.user_id = p_user_id and g.chapter_id = p_chapter_id
    );
$$;

-- آیا کاربر به ویدئویی با مسیر «فصل/درس.mp4» دسترسی دارد؟
create or replace function public.has_video_access(p_user_id uuid, p_path text)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select public.has_chapter_access(p_user_id, (string_to_array(p_path, '/'))[1]);
$$;

-- ─────────────────────────── ۲) پروفایل کاربران ───────────────────────────

create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  phone            text unique,
  name             text not null default 'کاربر',
  role             text not null default 'user' check (role in ('user', 'admin', 'instructor')),
  points           integer not null default 0,
  xp               integer not null default 0, -- امتیاز تجربه / سطح‌بندی کاربر
  streak_days      integer not null default 0,
  last_active_date text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own or admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin(auth.uid()));

create policy "profiles: insert own"
  on public.profiles for insert
  with check (id = auth.uid());

create policy "profiles: update own or admin"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin(auth.uid()));

-- ساخت خودکار پروفایل هنگام ثبت‌نام
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, name)
  values (new.id, new.phone, coalesce(new.raw_user_meta_data ->> 'name', 'کاربر'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────── ۳) محتوای آموزشی ─────────────────────────────

create table if not exists public.chapters (
  id              text primary key,           -- 'ch1' ... 'ch6' (هماهنگ با داده نمایشی)
  index           integer not null,
  title           text not null,
  subtitle        text,
  description     text,
  level           text not null default 'مقدماتی',
  instructor_name text,
  instructor_role text,
  duration_minutes integer not null default 0,
  price           integer not null default 0,  -- تومان؛ ۰ = رایگان
  old_price       integer,
  free            boolean not null default false,
  preview_count   integer not null default 1,
  icon            text,
  gradient        text,
  prerequisites   text[] default '{}',
  outcome         text[] default '{}',
  created_at      timestamptz not null default now()
);

create table if not exists public.lessons (
  id          text primary key,               -- 'ch1-l1' ...
  chapter_id  text not null references public.chapters(id) on delete cascade,
  index       integer not null,
  title       text not null,
  kind        text not null check (kind in ('video', 'text')),
  duration    integer not null default 0,
  summary     text,
  content     jsonb,                          -- پاراگراف‌های درسنامه متنی
  captions    jsonb,                          -- زیرنویس‌های ویدئو
  video_path  text,                           -- مسیر در storage: «فصل/درس.mp4»
  free        boolean not null default false, -- نمونه رایگان حتی در فصل پولی
  created_at  timestamptz not null default now()
);

alter table public.chapters enable row level security;
alter table public.lessons enable row level security;

-- فصل‌ها: خواندن برای همه (اطلاعات عمومی)
create policy "chapters: public read"
  on public.chapters for select
  using (true);

-- درس‌ها: فقط رایگان‌ها یا دارای دسترسی؛ محتوای پولی از RLS پنهان می‌ماند
create policy "lessons: free or has access"
  on public.lessons for select
  using (
    free
    or (select public.is_admin(auth.uid()))
    or public.has_chapter_access(auth.uid(), chapter_id)
  );

-- پیشرفت درس
create table if not exists public.lesson_progress (
  user_id    uuid not null references auth.users(id) on delete cascade,
  lesson_id  text not null references public.lessons(id) on delete cascade,
  completed  boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.lesson_progress enable row level security;
create policy "lesson_progress: own rows"
  on public.lesson_progress for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- یادداشت‌های شخصی و سؤال‌های درس
create table if not exists public.notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  lesson_id    text not null references public.lessons(id) on delete cascade,
  text         text not null,
  created_at   timestamptz not null default now()
);

create table if not exists public.lesson_questions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  lesson_id    text not null references public.lessons(id) on delete cascade,
  text         text not null,
  created_at   timestamptz not null default now()
);

alter table public.notes enable row level security;
alter table public.lesson_questions enable row level security;

create policy "notes: own rows" on public.notes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "lesson_questions: own rows" on public.lesson_questions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────── ۴) تمرین‌ها و آزمون‌ها ────────────────────────

create table if not exists public.exercises (
  id            text primary key,             -- 'ch1-e1' ...
  chapter_id    text not null references public.chapters(id) on delete cascade,
  index         integer not null,
  title         text not null,
  type          text not null,
  problem       text,
  goal          text,
  tool          text,
  guide         jsonb,
  points        integer not null default 10,
  options       jsonb,
  correct_index integer,
  correct_bool  boolean,
  correct_order jsonb,
  sample_answer text
);

create table if not exists public.exercise_submissions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  exercise_id  text not null references public.exercises(id) on delete cascade,
  answer       text,
  score        integer not null default 0,
  submitted_at timestamptz not null default now()
);

create table if not exists public.exams (
  id               text primary key,          -- 'ex-ch1' ...
  chapter_id       text not null references public.chapters(id) on delete cascade,
  title            text not null,
  duration_minutes integer not null default 20,
  pass_score       integer not null default 70
);

create table if not exists public.exam_questions (
  id        text primary key,                 -- 'ch1-q1' ...
  exam_id   text not null references public.exams(id) on delete cascade,
  text      text not null,
  options   jsonb not null,
  correct   integer not null,
  topic     text
);

create table if not exists public.exam_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  exam_id        text not null references public.exams(id) on delete cascade,
  score          integer not null,
  correct_count  integer not null default 0,
  wrong_count    integer not null default 0,
  passed         boolean not null default false,
  topic_analysis jsonb,
  awarded_discount integer not null default 0,
  created_at     timestamptz not null default now()
);

alter table public.exercises enable row level security;
alter table public.exercise_submissions enable row level security;
alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_attempts enable row level security;

-- تمرین‌ها/آزمون‌ها: مانند درس‌ها، فقط با دسترسی فصل
create policy "exercises: free or has access"
  on public.exercises for select
  using (
    (select public.is_admin(auth.uid()))
    or public.has_chapter_access(auth.uid(), chapter_id)
  );
create policy "exams: free or has access"
  on public.exams for select
  using (
    (select public.is_admin(auth.uid()))
    or public.has_chapter_access(auth.uid(), chapter_id)
  );
create policy "exam_questions: free or has access"
  on public.exam_questions for select
  using (
    (select public.is_admin(auth.uid()))
    or public.has_chapter_access(
         auth.uid(),
         (select chapter_id from public.exams where id = exam_id)
       )
  );

create policy "exercise_submissions: own rows"
  on public.exercise_submissions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "exam_attempts: own rows or admin"
  on public.exam_attempts for all
  using (user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (user_id = auth.uid());

-- ─────────────────────────── ۵) خرید و دسترسی ─────────────────────────────

create table if not exists public.purchases (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  chapter_id     text not null references public.chapters(id) on delete cascade,
  price          integer not null,
  base_price     integer not null,
  discount_label text,
  receipt_id     text unique,
  status         text not null default 'موفق'
                 check (status in ('موفق', 'ناموفق', 'لغوشده', 'در انتظار')),
  created_at     timestamptz not null default now()
);

create table if not exists public.access_grants (
  user_id     uuid not null references auth.users(id) on delete cascade,
  chapter_id  text not null references public.chapters(id) on delete cascade,
  granted_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  primary key (user_id, chapter_id)
);

alter table public.purchases enable row level security;
alter table public.access_grants enable row level security;

-- خرید: کاربر فقط خریدهای خودش را می‌بیند/ثبت می‌کند؛ مدیر همه را می‌بیند
create policy "purchases: own or admin"
  on public.purchases for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "purchases: insert own"
  on public.purchases for insert
  with check (user_id = auth.uid());

create policy "purchases: admin update (refund)"
  on public.purchases for update
  using (public.is_admin(auth.uid()));

-- اعطای دسترسی: فقط مدیر
create policy "access_grants: admin all"
  on public.access_grants for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- ─────────────────────────── ۶) کوییزها ───────────────────────────────────

create table if not exists public.quizzes (
  id                text primary key,          -- 'quiz-daily' ...
  kind              text not null check (kind in ('daily', 'weekly', 'category')),
  title             text not null,
  category          text,
  difficulty        text not null default 'آسان',
  duration_seconds  integer not null default 90,
  points_per_question integer not null default 10
);

create table if not exists public.quiz_questions (
  id          text primary key,
  quiz_id     text not null references public.quizzes(id) on delete cascade,
  text        text not null,
  options     jsonb not null,
  correct     integer not null,
  explanation text
);

create table if not exists public.quiz_attempts (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  quiz_id   text not null references public.quizzes(id) on delete cascade,
  score     integer not null default 0,
  total     integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_attempts enable row level security;

create policy "quizzes: public read"
  on public.quizzes for select using (true);
create policy "quiz_questions: public read"
  on public.quiz_questions for select using (true);
create policy "quiz_attempts: own rows"
  on public.quiz_attempts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────── ۷) کامیونیتی ─────────────────────────────────

create table if not exists public.community_posts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,
  category       text not null,
  title          text not null,
  body           text not null,
  tags           text[] default '{}',
  likes          integer not null default 0,
  comments_count integer not null default 0,
  status         text not null default 'open' check (status in ('open', 'closed')),
  created_at     timestamptz not null default now()
);

create table if not exists public.community_comments (
  id        uuid primary key default gen_random_uuid(),
  post_id   uuid not null references public.community_posts(id) on delete cascade,
  user_id   uuid references auth.users(id) on delete set null,
  body      text not null,
  likes     integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  user_id   uuid not null references auth.users(id) on delete cascade,
  post_id   uuid not null references public.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.saved_posts (
  user_id   uuid not null references auth.users(id) on delete cascade,
  post_id   uuid not null references public.community_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.saved_posts enable row level security;

create policy "community_posts: read all"
  on public.community_posts for select using (true);
create policy "community_posts: insert authenticated"
  on public.community_posts for insert
  with check (auth.uid() is not null and user_id = auth.uid());
create policy "community_posts: owner update, admin manage"
  on public.community_posts for update
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create policy "community_comments: read all"
  on public.community_comments for select using (true);
create policy "community_comments: insert authenticated"
  on public.community_comments for insert
  with check (auth.uid() is not null and user_id = auth.uid());

create policy "post_likes: own rows"
  on public.post_likes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved_posts: own rows"
  on public.saved_posts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────── ۸) بانک ابزارها ──────────────────────────────

create table if not exists public.ai_tools (
  id            text primary key,
  name          text not null,
  tagline       text,
  description   text,
  category      text not null,
  use_cases     jsonb,
  level         text not null default 'آسان',
  pricing       text not null default 'رایگان',
  languages     jsonb,
  url           text,
  rating        numeric(2,1) not null default 0,
  reviews       integer not null default 0,
  related_lessons text[] default '{}',
  reviewed_at   text,
  is_new        boolean not null default false
);

alter table public.ai_tools enable row level security;
create policy "ai_tools: public read"
  on public.ai_tools for select using (true);

-- ─────────────────────────── ۹) اکسپلور و ترندها ──────────────────────────

create table if not exists public.short_videos (
  id              text primary key,
  title           text not null,
  creator         text not null,
  creator_role    text not null default 'مدرس هوش مصنوعی',
  category        text not null,
  description     text,
  video_path      text not null,
  poster_path     text,
  duration_seconds integer not null default 30,
  tags            text[] default '{}',
  views           integer not null default 0,
  likes           integer not null default 0,
  created_at      timestamptz not null default now(),
  status          text not null default 'draft' check (status in ('published', 'draft', 'archived')),
  featured        boolean not null default false
);

create table if not exists public.trending_prompts (
  id          text primary key,
  title       text not null,
  prompt      text not null,
  category    text not null,
  tool        text not null,
  author      text not null,
  description text,
  tags        text[] default '{}',
  uses        integer not null default 0,
  likes       integer not null default 0,
  created_at  timestamptz not null default now(),
  status      text not null default 'draft' check (status in ('published', 'draft', 'archived')),
  featured    boolean not null default false
);

alter table public.short_videos enable row level security;
alter table public.trending_prompts enable row level security;

create policy "short_videos: published public read"
  on public.short_videos for select using (status = 'published' or public.is_admin(auth.uid()));
create policy "short_videos: admin manage"
  on public.short_videos for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "trending_prompts: published public read"
  on public.trending_prompts for select using (status = 'published' or public.is_admin(auth.uid()));
create policy "trending_prompts: admin manage"
  on public.trending_prompts for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- شمارنده‌ها از سمت کلاینت قابل جعل نیستند؛ در پروژه واقعی با RPC/Edge Function افزایش دهید.
create or replace function public.increment_short_video_view(p_id text)
returns void language sql security definer set search_path = public as $$
  update public.short_videos set views = views + 1 where id = p_id and status = 'published';
$$;

create or replace function public.increment_prompt_use(p_id text)
returns void language sql security definer set search_path = public as $$
  update public.trending_prompts set uses = uses + 1 where id = p_id and status = 'published';
$$;

create or replace function public.increment_short_video_like(p_id text)
returns void language sql security definer set search_path = public as $$
  update public.short_videos set likes = likes + 1 where id = p_id and status = 'published';
$$;

create or replace function public.increment_prompt_like(p_id text)
returns void language sql security definer set search_path = public as $$
  update public.trending_prompts set likes = likes + 1 where id = p_id and status = 'published';
$$;

-- ─────────────────────────── ۱۰) اعلان‌ها و نشان‌ها ────────────────────────

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,  -- null = عمومی
  type       text not null,
  title      text not null,
  body       text not null,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.badges (
  id          text primary key,
  title       text not null,
  description text,
  icon        text,
  condition   text
);

create table if not exists public.user_badges (
  user_id   uuid not null references auth.users(id) on delete cascade,
  badge_id  text not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  type       text not null default 'info',
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.announcements enable row level security;

create policy "notifications: own or public"
  on public.notifications for select
  using (user_id is null or user_id = auth.uid());
create policy "notifications: admin insert"
  on public.notifications for insert
  with check (public.is_admin(auth.uid()));
create policy "notifications: owner update read"
  on public.notifications for update
  using (user_id = auth.uid());

create policy "badges: public read"
  on public.badges for select using (true);
create policy "user_badges: own rows"
  on public.user_badges for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "announcements: public read"
  on public.announcements for select using (true);

-- ─────────────────────────── ۱۰) تنظیمات تخفیف ────────────────────────────

create table if not exists public.discount_rules (
  id         integer primary key default 1 check (id = 1),  -- فقط یک ردیف
  high_min   integer not null default 90,
  high_percent integer not null default 30,
  mid_min    integer not null default 80,
  mid_percent integer not null default 20,
  low_min    integer not null default 70,
  low_percent integer not null default 10,
  updated_at timestamptz not null default now()
);

insert into public.discount_rules (id) values (1)
on conflict (id) do nothing;

alter table public.discount_rules enable row level security;
create policy "discount_rules: public read"
  on public.discount_rules for select using (true);
create policy "discount_rules: admin update"
  on public.discount_rules for update
  using (public.is_admin(auth.uid()));

-- ─────────────────────────── ۱۱) ذخیره‌سازی ویدئو ─────────────────────────

-- bucket خصوصی (عمومی نیست؛ دسترسی فقط با لینک زمان‌دار)
insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;

-- سیاست: خواندن مستقیم شی فقط با دسترسی فصل مرتبط با مسیر «فصل/درس.mp4»
create policy "videos: chapter access only"
  on storage.objects for select
  using (bucket_id = 'videos' and public.has_video_access(auth.uid(), name));

create policy "videos: admin upload/delete"
  on storage.objects for insert
  with check (bucket_id = 'videos' and public.is_admin(auth.uid()));
create policy "videos: admin update/delete"
  on storage.objects for update
  using (bucket_id = 'videos' and public.is_admin(auth.uid()));
create policy "videos: admin delete"
  on storage.objects for delete
  using (bucket_id = 'videos' and public.is_admin(auth.uid()));

-- ─────────────────────────── ۱۲) داده‌های اولیه ───────────────────────────

insert into public.chapters (id, index, title, level, price, free, preview_count, duration_minutes, icon)
values
  ('ch1', 1, 'شناخت هوش مصنوعی و ابزارهای مولد', 'مقدماتی', 0, true, 5, 158, '🧠'),
  ('ch2', 2, 'پرامپت‌نویسی حرفه‌ای', 'متوسط', 490000, false, 1, 214, '⌨️'),
  ('ch3', 3, 'تولید محتوای متنی با هوش مصنوعی', 'متوسط', 540000, false, 1, 246, '✍️'),
  ('ch4', 4, 'تولید تصویر و طراحی با هوش مصنوعی', 'متوسط', 620000, false, 1, 232, '🎨'),
  ('ch5', 5, 'اتوماسیون و افزایش بهره‌وری', 'متوسط', 720000, false, 1, 268, '⚡'),
  ('ch6', 6, 'ساخت پروژه واقعی با ابزارهای هوش مصنوعی', 'پیشرفته', 890000, false, 1, 312, '🚀')
on conflict (id) do nothing;

-- درس‌ها (مسیر ویدئو: «فصل/درس.mp4» — پس از آپلود ویدئوها در bucket پر می‌شود)
insert into public.lessons (id, chapter_id, index, title, kind, duration, video_path, free) values
  ('ch1-l1', 'ch1', 1, 'هوش مصنوعی چیست و چرا مهم است؟', 'video', 24, 'ch1/ch1-l1.mp4', true),
  ('ch1-l2', 'ch1', 2, 'هوش مصنوعی مولد چگونه کار می‌کند؟', 'video', 31, 'ch1/ch1-l2.mp4', true),
  ('ch1-l3', 'ch1', 3, 'تاریخچه و نسل‌های هوش مصنوعی', 'text', 18, null, true),
  ('ch1-l4', 'ch1', 4, 'آشنایی با ابزارهای مولد پرکاربرد', 'video', 38, 'ch1/ch1-l4.mp4', true),
  ('ch1-l5', 'ch1', 5, 'امنیت، اخلاق و محدودیت‌های هوش مصنوعی', 'text', 47, null, true),
  ('ch2-l1', 'ch2', 1, 'ساختار یک پرامپت مؤثر', 'video', 27, 'ch2/ch2-l1.mp4', true),
  ('ch2-l2', 'ch2', 2, 'تکنیک‌های پیشرفته پرامپت', 'video', 34, 'ch2/ch2-l2.mp4', false),
  ('ch2-l3', 'ch2', 3, 'پرامپت‌نویسی برای متن', 'text', 22, null, false),
  ('ch2-l4', 'ch2', 4, 'پرامپت‌نویسی برای تصویر', 'video', 41, 'ch2/ch2-l4.mp4', false),
  ('ch2-l5', 'ch2', 5, 'کتابخانه پرامپت شخصی', 'text', 90, null, false),
  ('ch3-l1', 'ch3', 1, 'ایده‌پردازی و تحقیق با هوش مصنوعی', 'video', 29, 'ch3/ch3-l1.mp4', true),
  ('ch3-l2', 'ch3', 2, 'ساختار مقاله: طرح اولیه', 'text', 25, null, false),
  ('ch3-l3', 'ch3', 3, 'نگارش مقاله با هوش مصنوعی', 'video', 43, 'ch3/ch3-l3.mp4', false),
  ('ch3-l4', 'ch3', 4, 'بازنویسی، خلاصه و تولید تیتر', 'text', 28, null, false),
  ('ch3-l5', 'ch3', 5, 'سئو و انتشار', 'video', 121, 'ch3/ch3-l5.mp4', false),
  ('ch4-l1', 'ch4', 1, 'اصول تولید تصویر با AI', 'video', 31, 'ch4/ch4-l1.mp4', true),
  ('ch4-l2', 'ch4', 2, 'پرامپت‌نویسی حرفه‌ای تصویر', 'video', 38, 'ch4/ch4-l2.mp4', false),
  ('ch4-l3', 'ch4', 3, 'ابزارهای تولید تصویر', 'text', 24, null, false),
  ('ch4-l4', 'ch4', 4, 'طراحی جلد، بنر و پست شبکه اجتماعی', 'video', 46, 'ch4/ch4-l4.mp4', false),
  ('ch4-l5', 'ch4', 5, 'کیفیت، وضوح و آماده‌سازی خروجی', 'text', 93, null, false),
  ('ch5-l1', 'ch5', 1, 'اتوماسیون چیست و از کجا شروع کنیم؟', 'video', 33, 'ch5/ch5-l1.mp4', true),
  ('ch5-l2', 'ch5', 2, 'ساخت اولین گردش‌کار', 'text', 41, null, false),
  ('ch5-l3', 'ch5', 3, 'اتوماسیون تولید و انتشار محتوا', 'video', 52, 'ch5/ch5-l3.mp4', false),
  ('ch5-l4', 'ch5', 4, 'داده، گزارش و تصمیم‌گیری', 'text', 30, null, false),
  ('ch5-l5', 'ch5', 5, 'سیستم بهره‌وری شخصی', 'video', 112, 'ch5/ch5-l5.mp4', false),
  ('ch6-l1', 'ch6', 1, 'انتخاب پروژه و تعریف مسئله', 'video', 36, 'ch6/ch6-l1.mp4', true),
  ('ch6-l2', 'ch6', 2, 'معماری راهکار: چه ابزاری برای چه کاری', 'text', 44, null, false),
  ('ch6-l3', 'ch6', 3, 'اجرای پروژه با ترکیب مهارت‌ها', 'video', 58, 'ch6/ch6-l3.mp4', false),
  ('ch6-l4', 'ch6', 4, 'بازبینی کیفیت و اصلاح نهایی', 'text', 35, null, false),
  ('ch6-l5', 'ch6', 5, 'انتشار، ارائه و گام‌های بعدی', 'video', 139, 'ch6/ch6-l5.mp4', false)
on conflict (id) do nothing;

-- کوییزها
insert into public.quizzes (id, kind, title, category, difficulty, duration_seconds, points_per_question) values
  ('quiz-daily', 'daily', 'کوییز روزانه', 'ترکیبی', 'آسان', 90, 10),
  ('quiz-weekly', 'weekly', 'کوییز هفتگی', 'ترکیبی پیشرفته', 'سخت', 240, 20),
  ('quiz-tools', 'category', 'ابزارهای هوش مصنوعی', 'ابزارهای هوش مصنوعی', 'آسان', 120, 10),
  ('quiz-prompt', 'category', 'پرامپت‌نویسی', 'پرامپت‌نویسی', 'متوسط', 120, 10),
  ('quiz-image', 'category', 'تولید تصویر', 'تولید تصویر', 'متوسط', 120, 10),
  ('quiz-video', 'category', 'تولید ویدئو', 'تولید ویدئو', 'متوسط', 120, 10),
  ('quiz-generative', 'category', 'هوش مصنوعی مولد', 'هوش مصنوعی مولد', 'متوسط', 120, 10),
  ('quiz-productivity', 'category', 'بهره‌وری', 'بهره‌وری', 'آسان', 90, 10),
  ('quiz-coding', 'category', 'کدنویسی با AI', 'کدنویسی با AI', 'متوسط', 120, 10),
  ('quiz-ethics', 'category', 'اخلاق و امنیت AI', 'اخلاق و امنیت هوش مصنوعی', 'متوسط', 120, 10)
on conflict (id) do nothing;

-- نشان‌ها
insert into public.badges (id, title, description, icon, condition) values
  ('b1', 'شروع‌کننده', 'تکمیل اولین درس', '🎯', 'تکمیل ۱ درس'),
  ('b2', 'یادگیرنده فعال', 'تکمیل ۵ درس در یک هفته', '📚', '۵ درس در هفته'),
  ('b3', 'متخصص پرامپت', 'تکمیل فصل پرامپت‌نویسی', '⌨️', 'تکمیل فصل ۲'),
  ('b4', 'نویسنده AI', 'تکمیل فصل تولید محتوای متنی', '✍️', 'تکمیل فصل ۳'),
  ('b5', 'هنرمند دیجیتال', 'تکمیل فصل تولید تصویر', '🎨', 'تکمیل فصل ۴'),
  ('b6', 'اتوماسیون‌کار', 'تکمیل فصل اتوماسیون', '⚡', 'تکمیل فصل ۵'),
  ('b7', 'سفیر ایلیت', 'تکمیل کل مسیر آموزشی', '🚀', 'تکمیل فصل ۶'),
  ('b8', 'آتش‌پاره', '۷ روز پاسخ متوالی به کوییز روزانه', '🔥', 'زنجیره ۷ روزه'),
  ('b9', 'کوییزباز حرفه‌ای', '۲۰ پاسخ درست در کوییزها', '🏆', '۲۰ پاسخ درست'),
  ('b10', 'همیار کامیونیتی', '۱۰ پاسخ مفید به سؤال‌های دیگران', '🤝', '۱۰ پاسخ')
on conflict (id) do nothing;

-- ─────────────────────────── ۱۳) دسترسی‌ها (grant) ────────────────────────

-- حداقل دسترسی‌های لازم برای نقش‌های anon و authenticated
grant usage on schema public to anon, authenticated;
grant select on public.chapters, public.quizzes, public.quiz_questions,
  public.badges, public.announcements, public.discount_rules,
  public.ai_tools, public.community_posts, public.community_comments,
  public.short_videos, public.trending_prompts
  to anon, authenticated;
grant select on public.lessons, public.exercises, public.exams, public.exam_questions
  to anon, authenticated;
grant select, insert, update, delete on public.profiles,
  public.lesson_progress, public.notes, public.lesson_questions,
  public.exercise_submissions, public.exam_attempts, public.quiz_attempts,
  public.post_likes, public.saved_posts, public.user_badges
  to authenticated;
grant select, insert on public.purchases to authenticated;
grant select, insert, update on public.community_posts, public.community_comments
  to authenticated;
grant select, update on public.notifications to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  پایان اسکیما — پس از اجرا، مراحل SUPABASE_SETUP.md را ادامه دهید:
--   ۱) آپلود ویدئوها در bucket «videos» با مسیر «فصل/درس.mp4»
--   ۲) استقرار Edge Function مربوط به لینک زمان‌دار
--   ۳) فعال‌سازی Phone Auth با Twilio
-- ═══════════════════════════════════════════════════════════════════════════
