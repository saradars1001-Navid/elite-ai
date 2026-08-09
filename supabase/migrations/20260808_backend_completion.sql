-- Elite AI Academy backend completion migration
-- Run after supabase/schema.sql in Supabase SQL Editor.

-- ─────────────────────────── Profile hardening ────────────────────────────
create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin(auth.uid()) then
    if new.role is distinct from old.role
      or new.points is distinct from old.points
      or new.xp is distinct from old.xp then
      raise exception 'profile protected fields cannot be changed by the owner';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_fields on public.profiles;
create trigger protect_profile_fields
before update on public.profiles
for each row execute function public.prevent_profile_privilege_escalation();

-- ─────────────────────────── Admin content permissions ─────────────────────
create policy "chapters: admin insert" on public.chapters for insert
  with check (public.is_admin(auth.uid()));
create policy "chapters: admin update" on public.chapters for update
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "chapters: admin delete" on public.chapters for delete
  using (public.is_admin(auth.uid()));

create policy "lessons: admin insert" on public.lessons for insert
  with check (public.is_admin(auth.uid()));
create policy "lessons: admin update" on public.lessons for update
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "lessons: admin delete" on public.lessons for delete
  using (public.is_admin(auth.uid()));

create policy "exercises: admin manage" on public.exercises for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "exams: admin manage" on public.exams for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "exam_questions: admin manage" on public.exam_questions for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "quizzes: admin manage" on public.quizzes for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "quiz_questions: admin manage" on public.quiz_questions for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "ai_tools: admin manage" on public.ai_tools for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "notifications: admin update" on public.notifications for update
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "notifications: admin delete" on public.notifications for delete
  using (public.is_admin(auth.uid()));
create policy "community_posts: admin delete" on public.community_posts for delete
  using (public.is_admin(auth.uid()));
create policy "community_comments: owner update or admin" on public.community_comments for update
  using (user_id = auth.uid() or public.is_admin(auth.uid()))
  with check (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "community_comments: owner or admin delete" on public.community_comments for delete
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- ─────────────────────────── Coupons / checkout source of truth ────────────
create table if not exists public.coupons (
  code text primary key,
  percent integer not null check (percent between 0 and 100),
  active boolean not null default true,
  expires_at timestamptz,
  max_uses integer,
  used_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint coupon_expiry_valid check (expires_at is null or expires_at > created_at)
);

alter table public.coupons enable row level security;
create policy "coupons: active public read" on public.coupons for select
  using (active = true and (expires_at is null or expires_at > now()) or public.is_admin(auth.uid()));
create policy "coupons: admin manage" on public.coupons for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
grant select on public.coupons to anon, authenticated;
grant insert, update, delete on public.coupons to authenticated;

-- ─────────────────────────── Prompt Lab persistence ────────────────────────
create table if not exists public.prompt_tools (
  id text primary key,
  name text not null,
  emoji text not null default '🤖',
  category text not null default 'عمومی',
  description text,
  style text,
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_scenarios (
  id text primary key,
  title text not null,
  description text,
  category text not null,
  task_type text not null,
  tool_ids jsonb not null default '[]'::jsonb,
  sample_prompt text,
  goal text,
  time_seconds integer not null default 300,
  points integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scenario_id text not null references public.prompt_scenarios(id) on delete cascade,
  prompt text not null,
  score integer not null default 0,
  max_score integer not null default 100,
  criteria jsonb not null default '[]'::jsonb,
  tool_results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.prompt_tools enable row level security;
alter table public.prompt_scenarios enable row level security;
alter table public.prompt_attempts enable row level security;
create policy "prompt_tools: public read" on public.prompt_tools for select using (true);
create policy "prompt_tools: admin manage" on public.prompt_tools for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "prompt_scenarios: public read" on public.prompt_scenarios for select using (true);
create policy "prompt_scenarios: admin manage" on public.prompt_scenarios for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "prompt_attempts: own read insert" on public.prompt_attempts for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "prompt_attempts: own insert" on public.prompt_attempts for insert
  with check (user_id = auth.uid());
grant select on public.prompt_tools, public.prompt_scenarios to anon, authenticated;
grant insert, select on public.prompt_attempts to authenticated;

-- ─────────────────────────── Execute permissions / safe counters ───────────
revoke execute on function public.increment_short_video_view(text) from anon;
revoke execute on function public.increment_prompt_use(text) from anon;
revoke execute on function public.increment_short_video_like(text) from anon;
revoke execute on function public.increment_prompt_like(text) from anon;
grant execute on function public.increment_short_video_view(text) to authenticated;
grant execute on function public.increment_prompt_use(text) to authenticated;
grant execute on function public.increment_short_video_like(text) to authenticated;
grant execute on function public.increment_prompt_like(text) to authenticated;

-- ─────────────────────────── Grants for admin CRUD ─────────────────────────
grant insert, update, delete on public.chapters, public.lessons, public.exercises,
  public.exams, public.exam_questions, public.quizzes, public.quiz_questions,
  public.ai_tools, public.notifications, public.community_posts,
  public.community_comments to authenticated;
grant select, insert on public.lesson_progress, public.notes, public.lesson_questions,
  public.exercise_submissions, public.exam_attempts, public.quiz_attempts to authenticated;
