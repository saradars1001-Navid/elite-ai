import { supabase, isSupabaseConfigured, authErrorMessage } from "./supabase";
import { CHAPTERS } from "./data";
import type {
  AiTool,
  AppUser,
  Chapter,
  CommunityPost,
  ManagedUser,
  NotificationItem,
  PromptAttempt,
  PromptScenario,
  PromptTool,
  Quiz,
  Role,
  ShortVideo,
  TrendingPrompt,
} from "./types";
import {
  isLaravelConfigured,
  laravelAccessMap,
  laravelAdminDeleteUser,
  laravelAdminSaveUser,
  laravelChargeWallet,
  laravelCreateCheckout,
  laravelDeleteNotification,
  laravelLoadAdminUsers,
  laravelLoadCatalog,
  laravelLoadCommunity,
  laravelLoadDiscovery,
  laravelLoadNotifications,
  laravelLoadPromptLab,
  laravelLoadUser,
  laravelLogout,
  laravelMarkAllNotificationsRead,
  laravelMarkNotificationRead,
  laravelPurchaseStatus,
  laravelRefundPurchase,
  laravelRequestOtp,
  laravelRequestRefund,
  laravelSetName,
  laravelSubmitExam,
  laravelSubmitPromptAttempt,
  laravelSubmitQuiz,
  laravelToken,
  laravelVerifyOtp,
  laravelWalletInfo,
  type ChargeResult,
  type WalletInfo,
} from "./laravel";
import {
  laravelAdminDelete,
  laravelAdminPaymentEvents,
  laravelAdminPricingPreview,
  laravelAdminRefundApprove,
  laravelAdminRefundReject,
  laravelAdminRefundRequests,
  laravelAdminSave,
  laravelAdminSendNotification,
  laravelAdminStats,
  type AdminPaymentEvent,
  type AdminPricingPreview,
  type AdminRefundRequest,
  type AdminStats,
} from "./laravel-admin";

/**
 * Service layer between the app store and Supabase.
 * Every function degrades gracefully: when Supabase is not configured the
 * caller falls back to demo mode — the app must never crash without a backend.
 */

export function backendEnabled(): boolean {
  return isSupabaseConfigured || isLaravelConfigured();
}

/** Admin dashboard statistics — real DB aggregates when a backend is configured. */
export async function backendAdminStats(): Promise<AdminStats | null> {
  if (isLaravelConfigured()) return laravelAdminStats();
  // Supabase mode: aggregated stats are not implemented as RPCs yet — the
  // dashboard falls back to its local collections in that case.
  return null;
}

/** Payment webhook/callback audit log (admin-only, Laravel mode). */
export async function backendAdminPaymentEvents(): Promise<AdminPaymentEvent[] | null> {
  if (isLaravelConfigured()) return laravelAdminPaymentEvents();
  return null;
}

/**
 * Server-side pricing simulation (admin-only). Returns null without a Laravel
 * backend so the admin page falls back to its local demo calculator.
 */
export async function backendAdminPricingPreview(payload: {
  chapterId: string;
  examScore?: number | null;
  couponCode?: string | null;
}): Promise<AdminPricingPreview | null> {
  if (isLaravelConfigured()) return laravelAdminPricingPreview(payload);
  return null;
}

/* ─────────────────────────────── Auth (SMS OTP) ─────────────────────────── */

export async function backendRequestOtp(
  phone: string
): Promise<{ ok: boolean; error?: string; debugCode?: string }> {
  if (isLaravelConfigured()) return laravelRequestOtp(phone);
  const { error } = await supabase!.auth.signInWithOtp({ phone });
  if (error) return { ok: false, error: authErrorMessage(error) };
  return { ok: true };
}

export async function backendVerifyOtp(
  phone: string,
  token: string,
  name?: string
): Promise<{ ok: boolean; error?: string; userId?: string; profileName?: string | null }> {
  if (isLaravelConfigured() && name && laravelToken()) {
    const updated = await laravelSetName(name);
    return { ok: true, userId: updated.id, profileName: updated.name };
  }
  if (isLaravelConfigured()) return laravelVerifyOtp(phone, token, name);
  const { data, error } = await supabase!.auth.verifyOtp({ phone, token, type: "sms" });
  if (error || !data.user) {
    return { ok: false, error: authErrorMessage(error) };
  }
  const { data: profile } = await supabase!
    .from("profiles")
    .select("name")
    .eq("id", data.user.id)
    .maybeSingle();
  return { ok: true, userId: data.user.id, profileName: profile?.name ?? null };
}

export async function backendSetName(userId: string, name: string): Promise<void> {
  if (isLaravelConfigured()) {
    await laravelSetName(name);
    return;
  }
  await supabase!
    .from("profiles")
    .upsert(
      { id: userId, name: name.trim(), updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
}

export async function backendLoadUser(): Promise<AppUser | null> {
  if (isLaravelConfigured()) return laravelLoadUser();
  const { data } = await supabase!.auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  return mapToAppUser(u);
}

async function mapToAppUser(u: {
  id: string;
  phone?: string | null;
  created_at?: string;
}): Promise<AppUser | null> {
  const { data: profile } = await supabase!
    .from("profiles")
    .select("*")
    .eq("id", u.id)
    .maybeSingle();
  return {
    id: u.id,
    phone: u.phone ?? profile?.phone ?? "",
    name: profile?.name || u.phone || "کاربر",
    role: (profile?.role ?? "user") as Role,
    joinedAt: profile?.created_at ?? u.created_at ?? new Date().toISOString(),
    points: profile?.points ?? 0,
    xp: profile?.xp ?? profile?.points ?? 0,
    streakDays: profile?.streak_days ?? 0,
    lastActiveDate: profile?.last_active_date ?? "",
  };
}

export async function backendSignOut(): Promise<void> {
  if (isLaravelConfigured()) return laravelLogout();
  await supabase!.auth.signOut();
}

/** Update the login-day streak in the profile. */
export async function backendTouchActivity(userId: string): Promise<void> {
  if (isLaravelConfigured()) return;
  const today = new Date().toISOString().slice(0, 10);
  const { data: profile } = await supabase!
    .from("profiles")
    .select("last_active_date, streak_days")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return;
  if (profile.last_active_date === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = profile.last_active_date === yesterday ? (profile.streak_days ?? 0) + 1 : 1;
  await supabase!
    .from("profiles")
    .update({ last_active_date: today, streak_days: streak })
    .eq("id", userId);
}

/* ─────────────────────────── User activity persistence ─────────────────── */

export async function backendUpsertLessonProgress(
  userId: string,
  lessonId: string,
  completed: boolean
): Promise<void> {
  if (isLaravelConfigured()) return;
  await supabase!
    .from("lesson_progress")
    .upsert(
      { user_id: userId, lesson_id: lessonId, completed, updated_at: new Date().toISOString() },
      { onConflict: "user_id,lesson_id" }
    );
}

export async function backendSubmitExercise(
  userId: string,
  exerciseId: string,
  answer: string,
  score: number
): Promise<void> {
  if (isLaravelConfigured()) return;
  await supabase!
    .from("exercise_submissions")
    .insert({ user_id: userId, exercise_id: exerciseId, answer, score });
}

/**
 * Submit the exam to the backend (answer indices only — never the client's
 * score). In Laravel mode the server grades, stores the attempt and sends the
 * result + performance-discount notification (in-app + SMS). Returns the
 * server's authoritative result, or null when unreachable.
 */
export async function backendSubmitExam(
  userId: string,
  attempt: {
    examId: string;
    chapterId: string;
    score: number;
    correct: number;
    wrong: number;
    passed: boolean;
    topicAnalysis: unknown;
    awardedDiscount: number;
  },
  answers: (number | null)[]
): Promise<{
  attemptId: number | string;
  score: number;
  correct: number;
  wrong: number;
  passed: boolean;
  awardedDiscount: number;
  discountChapterId: string | null;
} | null> {
  if (isLaravelConfigured()) {
    return laravelSubmitExam(attempt.chapterId, answers);
  }
  await supabase!.from("exam_attempts").insert({
    user_id: userId,
    exam_id: attempt.examId,
    score: attempt.score,
    correct_count: attempt.correct,
    wrong_count: attempt.wrong,
    passed: attempt.passed,
    topic_analysis: attempt.topicAnalysis,
    awarded_discount: attempt.awardedDiscount,
  });
  return null;
}

export async function backendSubmitQuiz(
  userId: string,
  quizId: string,
  score: number,
  total: number,
  answers: number[] = [],
  durationSeconds = 0
): Promise<void> {
  if (isLaravelConfigured()) {
    await laravelSubmitQuiz(quizId, answers, durationSeconds);
    return;
  }
  await supabase!.from("quiz_attempts").insert({ user_id: userId, quiz_id: quizId, score, total });
}

export async function backendCreateNote(
  userId: string,
  lessonId: string,
  text: string
): Promise<void> {
  if (isLaravelConfigured()) return;
  await supabase!.from("notes").insert({ user_id: userId, lesson_id: lessonId, text });
}

export async function backendDeleteNote(userId: string, noteId: string): Promise<void> {
  if (isLaravelConfigured()) return;
  await supabase!.from("notes").delete().eq("id", noteId).eq("user_id", userId);
}

export async function backendSaveAiTool(tool: AiTool): Promise<void> {
  if (isLaravelConfigured()) {
    await laravelAdminSave("tools", tool as unknown as Record<string, unknown>);
    return;
  }
  await supabase!.from("ai_tools").upsert({
    id: tool.id,
    name: tool.name,
    tagline: tool.tagline,
    description: tool.description,
    category: tool.category,
    use_cases: tool.useCases,
    level: tool.level,
    pricing: tool.pricing,
    languages: tool.languages,
    url: tool.url,
    rating: tool.rating,
    reviews: tool.reviews,
    related_lessons: tool.relatedLessons,
    reviewed_at: tool.reviewedAt,
    is_new: tool.isNew ?? false,
  });
}

export async function backendDeleteAiTool(id: string): Promise<void> {
  if (isLaravelConfigured()) {
    await laravelAdminDelete("tools", id);
    return;
  }
  await supabase!.from("ai_tools").delete().eq("id", id);
}

export async function backendSaveQuiz(quiz: Quiz): Promise<void> {
  if (isLaravelConfigured()) {
    await laravelAdminSave("quizzes", quiz as unknown as Record<string, unknown>);
    return;
  }
  const { error } = await supabase!.from("quizzes").upsert({
    id: quiz.id,
    kind: quiz.kind,
    title: quiz.title,
    category: quiz.category,
    difficulty: quiz.difficulty,
    duration_seconds: quiz.durationSeconds,
    points_per_question: quiz.pointsPerQuestion,
  });
  if (error) return;
  await supabase!.from("quiz_questions").delete().eq("quiz_id", quiz.id);
  if (quiz.questions.length)
    await supabase!.from("quiz_questions").insert(
      quiz.questions.map((q) => ({
        id: q.id,
        quiz_id: quiz.id,
        text: q.text,
        options: q.options,
        correct: q.correct,
        explanation: q.explanation,
      }))
    );
}

export async function backendDeleteQuiz(id: string): Promise<void> {
  if (isLaravelConfigured()) {
    await laravelAdminDelete("quizzes", id);
    return;
  }
  await supabase!.from("quizzes").delete().eq("id", id);
}

export async function backendSaveChapter(chapter: Chapter): Promise<void> {
  if (isLaravelConfigured()) {
    await laravelAdminSave("chapters", chapter as unknown as Record<string, unknown>);
    return;
  }
  const { error } = await supabase!.from("chapters").upsert({
    id: chapter.id,
    index: chapter.index,
    title: chapter.title,
    subtitle: chapter.subtitle,
    description: chapter.description,
    level: chapter.level,
    instructor_name: chapter.instructor.name,
    instructor_role: chapter.instructor.role,
    duration_minutes: chapter.duration,
    price: chapter.price,
    old_price: chapter.oldPrice ?? null,
    free: chapter.free,
    preview_count: chapter.previewCount,
    icon: chapter.icon,
    gradient: chapter.gradient,
    prerequisites: chapter.prerequisites,
    outcome: chapter.outcome,
  });
  if (error) return;
  await supabase!.from("lessons").upsert(
    chapter.lessons.map((l) => ({
      id: l.id,
      chapter_id: chapter.id,
      index: l.index,
      title: l.title,
      kind: l.kind,
      duration: l.duration,
      summary: l.summary,
      content: l.content,
      captions: l.captions ?? null,
      free: l.free,
    }))
  );
  await supabase!.from("exercises").upsert(
    chapter.exercises.map((e) => ({
      id: e.id,
      chapter_id: chapter.id,
      index: e.index,
      title: e.title,
      type: e.type,
      problem: e.problem,
      goal: e.goal,
      tool: e.tool ?? null,
      guide: e.guide,
      points: e.points,
      options: e.options ?? null,
      correct_index: e.correctIndex ?? null,
      correct_bool: e.correctBool ?? null,
      correct_order: e.correctOrder ?? null,
      sample_answer: e.sampleAnswer,
    }))
  );
  await supabase!.from("exams").upsert({
    id: chapter.exam.id,
    chapter_id: chapter.id,
    title: chapter.exam.title,
    duration_minutes: chapter.exam.durationMinutes,
    pass_score: chapter.exam.passScore,
  });
  await supabase!.from("exam_questions").upsert(
    chapter.exam.questions.map((q) => ({
      id: q.id,
      exam_id: chapter.exam.id,
      text: q.text,
      options: q.options,
      correct: q.correct,
      topic: q.topic,
    }))
  );
}

export async function backendDeleteChapter(id: string): Promise<void> {
  if (isLaravelConfigured()) {
    await laravelAdminDelete("chapters", id);
    return;
  }
  await supabase!.from("chapters").delete().eq("id", id);
}

export async function backendAskQuestion(
  userId: string,
  lessonId: string,
  text: string
): Promise<void> {
  if (isLaravelConfigured()) return;
  await supabase!.from("lesson_questions").insert({ user_id: userId, lesson_id: lessonId, text });
}

export async function backendSavePromptTool(tool: PromptTool): Promise<void> {
  if (isLaravelConfigured()) return;
  await supabase!.from("prompt_tools").upsert({
    id: tool.id,
    name: tool.name,
    emoji: tool.emoji,
    category: tool.category,
    description: tool.description,
    style: tool.style,
  });
}

export async function backendDeletePromptTool(id: string): Promise<void> {
  if (isLaravelConfigured()) return;
  await supabase!.from("prompt_tools").delete().eq("id", id);
}

export async function backendSavePromptScenario(scenario: PromptScenario): Promise<void> {
  if (isLaravelConfigured()) return;
  await supabase!.from("prompt_scenarios").upsert({
    id: scenario.id,
    title: scenario.title,
    description: scenario.description,
    category: scenario.category,
    task_type: scenario.taskType,
    tool_ids: scenario.toolIds,
    sample_prompt: scenario.samplePrompt,
    goal: scenario.goal,
    time_seconds: scenario.timeSeconds,
    points: scenario.points,
  });
}

export async function backendDeletePromptScenario(id: string): Promise<void> {
  if (isLaravelConfigured()) return;
  await supabase!.from("prompt_scenarios").delete().eq("id", id);
}

export async function backendLoadPromptLab(): Promise<{
  promptTools: PromptTool[];
  promptScenarios: PromptScenario[];
}> {
  if (isLaravelConfigured()) return laravelLoadPromptLab();
  const [tools, scenarios] = await Promise.all([
    supabase!.from("prompt_tools").select("*").order("created_at", { ascending: true }),
    supabase!.from("prompt_scenarios").select("*").order("created_at", { ascending: true }),
  ]);
  return {
    promptTools: (tools.data ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      emoji: t.emoji,
      category: t.category,
      description: t.description ?? "",
      style: t.style ?? "",
    })),
    promptScenarios: (scenarios.data ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description ?? "",
      category: s.category,
      taskType: s.task_type,
      toolIds: s.tool_ids ?? [],
      samplePrompt: s.sample_prompt ?? "",
      goal: s.goal ?? "",
      timeSeconds: s.time_seconds,
      points: s.points,
    })),
  };
}

export async function backendSubmitPromptAttempt(
  userId: string,
  attempt: PromptAttempt
): Promise<void> {
  if (isLaravelConfigured()) {
    await laravelSubmitPromptAttempt(attempt);
    return;
  }
  await supabase!.from("prompt_attempts").insert({
    user_id: userId,
    scenario_id: attempt.scenarioId,
    prompt: attempt.prompt,
    score: attempt.score,
    max_score: attempt.maxScore,
    criteria: attempt.criteria,
    tool_results: attempt.toolResults,
  });
}

export async function backendCreatePost(
  userId: string,
  post: { category: string; title: string; body: string; tags: string[] }
): Promise<void> {
  if (isLaravelConfigured()) return;
  await supabase!.from("community_posts").insert({
    user_id: userId,
    category: post.category,
    title: post.title,
    body: post.body,
    tags: post.tags,
  });
}

export async function backendCreateComment(
  userId: string,
  postId: string,
  body: string
): Promise<void> {
  if (isLaravelConfigured()) return;
  await supabase!.from("community_comments").insert({ user_id: userId, post_id: postId, body });
}

export async function backendTogglePostLike(
  userId: string,
  postId: string,
  liked: boolean
): Promise<void> {
  if (isLaravelConfigured()) return;
  if (liked)
    await supabase!
      .from("post_likes")
      .upsert({ user_id: userId, post_id: postId }, { onConflict: "user_id,post_id" });
  else await supabase!.from("post_likes").delete().eq("user_id", userId).eq("post_id", postId);
}

export async function backendToggleSavedPost(
  userId: string,
  postId: string,
  saved: boolean
): Promise<void> {
  if (isLaravelConfigured()) return;
  if (saved)
    await supabase!
      .from("saved_posts")
      .upsert({ user_id: userId, post_id: postId }, { onConflict: "user_id,post_id" });
  else await supabase!.from("saved_posts").delete().eq("user_id", userId).eq("post_id", postId);
}

/* ─────────────────────── broadcast notifications (admin) ─────────────────────── */

/**
 * Send a public/group announcement. In Laravel mode the API creates the rows;
 * in demo mode returns null so the panel keeps its local-only behavior.
 */
export async function backendAdminSendNotification(payload: {
  type: string;
  title: string;
  body: string;
  link?: string;
  audience: "all" | "chapter-buyers" | "active-30d" | "no-purchase";
  chapterId?: string;
}): Promise<{ recipients: number } | null> {
  if (isLaravelConfigured()) return laravelAdminSendNotification(payload);
  return null;
}

/* ─────────────────────── refund requests (admin) ─────────────────────── */

/** Refund requests for the admin panel — real DB rows in Laravel mode. */
export async function backendAdminRefundRequests(
  status: "pending" | "done" = "pending"
): Promise<AdminRefundRequest[] | null> {
  if (isLaravelConfigured()) return laravelAdminRefundRequests(status);
  return null;
}

export async function backendAdminRefundApprove(
  purchaseId: string
): Promise<{ ok: boolean; error?: string }> {
  if (isLaravelConfigured()) return laravelAdminRefundApprove(purchaseId);
  return { ok: false, error: "بدون اتصال به سرویس‌دهنده، تأیید بازگشت وجه در دسترس نیست" };
}

export async function backendAdminRefundReject(
  purchaseId: string,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  if (isLaravelConfigured()) return laravelAdminRefundReject(purchaseId, reason);
  return { ok: false, error: "بدون اتصال به سرویس‌دهنده، رد درخواست بازگشت وجه در دسترس نیست" };
}

/* ─────────────────────────── Access control (RLS-backed) ────────────────── */

/** Chapter access map straight from the database (purchases + access_grants). */
export async function backendAccessMap(userId: string): Promise<Record<string, boolean>> {
  if (isLaravelConfigured()) return laravelAccessMap();
  const map: Record<string, boolean> = {};
  const [purchases, grants] = await Promise.all([
    supabase!.from("purchases").select("chapter_id").eq("user_id", userId).eq("status", "موفق"),
    supabase!.from("access_grants").select("chapter_id").eq("user_id", userId),
  ]);
  (purchases.data ?? []).forEach((r) => (map[r.chapter_id] = true));
  (grants.data ?? []).forEach((r) => (map[r.chapter_id] = true));
  return map;
}

export async function backendCreatePurchase(p: {
  userId: string;
  chapterId: string;
  price: number;
  basePrice: number;
  discountLabel: string;
  receiptId: string;
}): Promise<void> {
  if (isLaravelConfigured()) return;
  // Legacy compatibility path. New production checkouts should use
  // backendCreateCheckout so the server calculates the price and creates a
  // pending order before the payment gateway confirms it.
  await supabase!.from("purchases").insert({
    user_id: p.userId,
    chapter_id: p.chapterId,
    price: p.price,
    base_price: p.basePrice,
    discount_label: p.discountLabel,
    receipt_id: p.receiptId,
    status: "در انتظار",
  });
}

export async function backendCreateCheckout(
  chapterId: string,
  couponCode?: string,
  paymentMethod?: "gateway" | "wallet"
): Promise<{
  ok: boolean;
  purchaseId?: string;
  amount?: number;
  checkoutUrl?: string | null;
  walletPaid?: boolean;
  error?: string;
}> {
  if (isLaravelConfigured()) {
    const res = await laravelCreateCheckout(chapterId, couponCode, paymentMethod);
    if (res.error) return { ok: false, error: res.error };
    return {
      ok: true,
      purchaseId: res.purchaseId,
      amount: res.amount,
      checkoutUrl: res.checkoutUrl ?? null,
      walletPaid: res.walletPaid,
    };
  }
  try {
    const { data, error } = await supabase!.functions.invoke<{
      purchase?: { id?: string };
      amount?: number;
      checkoutUrl?: string | null;
      error?: string;
    }>("create-checkout", { body: { chapterId, couponCode } });
    if (error || data?.error) return { ok: false, error: data?.error ?? "checkout_failed" };
    return {
      ok: true,
      purchaseId: data?.purchase?.id,
      amount: data?.amount,
      checkoutUrl: data?.checkoutUrl ?? null,
    };
  } catch {
    return { ok: false, error: "checkout_unavailable" };
  }
}

export async function backendFetchPurchaseStatus(purchaseId: string) {
  if (isLaravelConfigured()) return laravelPurchaseStatus(purchaseId);
  return null;
}

export async function backendRefundPurchase(
  purchaseId: string
): Promise<{ ok: boolean; error?: string }> {
  if (isLaravelConfigured()) return laravelRefundPurchase(purchaseId);
  return { ok: false, error: "بدون اتصال به سرویس‌دهنده، بازگشت وجه در دسترس نیست" };
}

/** Buyer requests a refund on a paid purchase (pending until admin approval). */
export async function backendRequestRefund(
  purchaseId: string,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  if (isLaravelConfigured()) return laravelRequestRefund(purchaseId, reason);
  return { ok: true };
}

export async function backendWalletInfo(): Promise<WalletInfo | null> {
  if (isLaravelConfigured()) return laravelWalletInfo();
  return null;
}

export async function backendChargeWallet(amount: number): Promise<ChargeResult> {
  if (isLaravelConfigured()) return laravelChargeWallet(amount);
  return { error: "شارژ کیف پول از درگاه با اتصال به سرویس‌دهنده فعال می‌شود" };
}

export async function backendGrantAccess(userId: string, chapterId: string): Promise<void> {
  if (isLaravelConfigured()) return;
  await supabase!.from("access_grants").insert({
    user_id: userId,
    chapter_id: chapterId,
    granted_by: userId,
  });
}

/* ─────────────────────────── Secure video (signed URL) ──────────────────── */

/**
 * Ask the Edge Function for a short-lived signed URL.
 * The server checks the user's chapter access in the database (never trust the
 * client), then signs a URL for the private `videos` bucket.
 */
export async function backendFetchLessonVideoUrl(lessonId: string): Promise<{
  url?: string;
  expiresIn?: number;
  denied?: boolean;
  unavailable?: boolean;
}> {
  if (isLaravelConfigured()) return { unavailable: true };
  try {
    const { data, error } = await supabase!.functions.invoke<{
      url?: string;
      expiresIn?: number;
      error?: string;
    }>("signed-video-url", { body: { lessonId } });
    if (error) return { unavailable: true };
    if (data?.error === "forbidden") return { denied: true };
    if (data?.url) return { url: data.url, expiresIn: data.expiresIn };
    return { unavailable: true };
  } catch {
    return { unavailable: true };
  }
}

/** Points/streak helpers kept local to the store for now (documented). */
/* ─────────────────────── Explore + prompt trends ───────────────────────── */

export async function backendLoadCatalog(): Promise<{
  chapters: Chapter[];
  quizzes: Quiz[];
  aiTools: AiTool[];
}> {
  if (isLaravelConfigured()) return laravelLoadCatalog();
  const [
    chapterRows,
    lessonRows,
    exerciseRows,
    examRows,
    examQuestionRows,
    quizRows,
    quizQuestionRows,
    toolRows,
  ] = await Promise.all([
    supabase!.from("chapters").select("*").order("index", { ascending: true }),
    supabase!.from("lessons").select("*").order("index", { ascending: true }),
    supabase!.from("exercises").select("*").order("index", { ascending: true }),
    supabase!.from("exams").select("*"),
    supabase!.from("exam_questions").select("*"),
    supabase!.from("quizzes").select("*"),
    supabase!.from("quiz_questions").select("*"),
    supabase!.from("ai_tools").select("*").order("name", { ascending: true }),
  ]);
  const dbChapters = chapterRows.data ?? [];
  const chapters: Chapter[] = dbChapters.map((row) => {
    const fallback = CHAPTERS.find((c) => c.id === row.id) ?? CHAPTERS[0];
    const dbLessons = (lessonRows.data ?? []).filter((l) => l.chapter_id === row.id);
    const lessonMap = new Map(dbLessons.map((l) => [l.id, l]));
    const lessons = fallback.lessons.map((local) => {
      const l = lessonMap.get(local.id);
      return l
        ? {
            ...local,
            title: l.title,
            index: l.index,
            kind: l.kind,
            duration: l.duration,
            summary: l.summary ?? local.summary,
            content: Array.isArray(l.content) ? l.content : local.content,
            captions: Array.isArray(l.captions) ? l.captions : local.captions,
            free: l.free,
          }
        : local;
    });
    const dbExercises = (exerciseRows.data ?? []).filter((e) => e.chapter_id === row.id);
    const exerciseMap = new Map(dbExercises.map((e) => [e.id, e]));
    const exercises = fallback.exercises.map((local) => {
      const e = exerciseMap.get(local.id);
      return e
        ? {
            ...local,
            title: e.title,
            index: e.index,
            type: e.type,
            problem: e.problem ?? local.problem,
            goal: e.goal ?? local.goal,
            tool: e.tool ?? local.tool,
            guide: Array.isArray(e.guide) ? e.guide : local.guide,
            points: e.points,
            options: Array.isArray(e.options) ? e.options : local.options,
            correctIndex: e.correct_index ?? local.correctIndex,
            correctBool: e.correct_bool ?? local.correctBool,
            correctOrder: Array.isArray(e.correct_order) ? e.correct_order : local.correctOrder,
            sampleAnswer: e.sample_answer ?? local.sampleAnswer,
          }
        : local;
    });
    const examRow = (examRows.data ?? []).find((e) => e.chapter_id === row.id);
    const examQuestions = (examQuestionRows.data ?? []).filter((q) => q.exam_id === examRow?.id);
    const exam = examRow
      ? {
          ...fallback.exam,
          id: examRow.id,
          title: examRow.title,
          durationMinutes: examRow.duration_minutes,
          passScore: examRow.pass_score,
          questions: examQuestions.length
            ? examQuestions.map((q) => ({
                id: q.id,
                text: q.text,
                options: q.options,
                correct: q.correct,
                topic: q.topic ?? "عمومی",
              }))
            : fallback.exam.questions,
        }
      : fallback.exam;
    return {
      ...fallback,
      id: row.id,
      index: row.index,
      title: row.title,
      subtitle: row.subtitle ?? fallback.subtitle,
      description: row.description ?? fallback.description,
      level: row.level,
      instructor: {
        name: row.instructor_name ?? fallback.instructor.name,
        role: row.instructor_role ?? fallback.instructor.role,
      },
      duration: row.duration_minutes,
      price: row.price,
      oldPrice: row.old_price ?? undefined,
      free: row.free,
      previewCount: row.preview_count,
      icon: row.icon ?? fallback.icon,
      gradient: row.gradient ?? fallback.gradient,
      prerequisites: row.prerequisites ?? fallback.prerequisites,
      outcome: row.outcome ?? fallback.outcome,
      lessons,
      exercises,
      exam,
    };
  });
  const quizzes: Quiz[] = (quizRows.data ?? []).map((q) => ({
    id: q.id,
    kind: q.kind,
    title: q.title,
    category: q.category ?? "عمومی",
    difficulty: q.difficulty,
    durationSeconds: q.duration_seconds,
    pointsPerQuestion: q.points_per_question,
    questions: (quizQuestionRows.data ?? [])
      .filter((qq) => qq.quiz_id === q.id)
      .map((qq) => ({
        id: qq.id,
        text: qq.text,
        options: qq.options,
        correct: qq.correct,
        explanation: qq.explanation ?? "",
      })),
  }));
  const aiTools: AiTool[] = (toolRows.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    tagline: t.tagline ?? "",
    description: t.description ?? "",
    category: t.category,
    useCases: t.use_cases ?? [],
    level: t.level,
    pricing: t.pricing,
    languages: t.languages ?? [],
    url: t.url ?? "",
    rating: Number(t.rating ?? 0),
    reviews: t.reviews ?? 0,
    relatedLessons: t.related_lessons ?? [],
    reviewedAt: t.reviewed_at ?? "",
    isNew: t.is_new,
    output: "",
  }));
  return { chapters, quizzes, aiTools };
}

export async function backendLoadManagedUsers(): Promise<ManagedUser[]> {
  if (isLaravelConfigured()) return laravelLoadAdminUsers();
  return [];
}
export async function backendAdminSaveUser(user: ManagedUser): Promise<void> {
  if (isLaravelConfigured()) await laravelAdminSaveUser(user);
}
export async function backendAdminDeleteUser(id: string): Promise<void> {
  if (isLaravelConfigured()) await laravelAdminDeleteUser(id);
}

export async function backendLoadCommunity(): Promise<CommunityPost[]> {
  if (isLaravelConfigured()) return laravelLoadCommunity();
  return [];
}

export async function backendLoadDiscovery(): Promise<{
  shortVideos: ShortVideo[];
  trendingPrompts: TrendingPrompt[];
}> {
  if (isLaravelConfigured()) return laravelLoadDiscovery();
  const [videos, prompts] = await Promise.all([
    supabase!
      .from("short_videos")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false }),
    supabase!
      .from("trending_prompts")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false }),
  ]);
  const shortVideos: ShortVideo[] = (videos.data ?? []).map((v) => ({
    id: v.id,
    title: v.title,
    creator: v.creator,
    creatorRole: v.creator_role,
    category: v.category,
    description: v.description ?? "",
    videoUrl: v.video_path,
    posterUrl: v.poster_path ?? undefined,
    durationSeconds: v.duration_seconds,
    tags: v.tags ?? [],
    views: v.views,
    likes: v.likes,
    createdAt: v.created_at,
    status: v.status,
    featured: v.featured,
  }));
  const trendingPrompts: TrendingPrompt[] = (prompts.data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    prompt: p.prompt,
    category: p.category,
    tool: p.tool,
    author: p.author,
    description: p.description ?? "",
    tags: p.tags ?? [],
    uses: p.uses,
    likes: p.likes,
    createdAt: p.created_at,
    status: p.status,
    featured: p.featured,
  }));
  return { shortVideos, trendingPrompts };
}

export async function backendSaveShortVideo(v: ShortVideo): Promise<void> {
  if (isLaravelConfigured()) {
    await laravelAdminSave("videos", v as unknown as Record<string, unknown>);
    return;
  }
  await supabase!.from("short_videos").upsert({
    id: v.id,
    title: v.title,
    creator: v.creator,
    creator_role: v.creatorRole,
    category: v.category,
    description: v.description,
    video_path: v.videoUrl,
    poster_path: v.posterUrl ?? null,
    duration_seconds: v.durationSeconds,
    tags: v.tags,
    views: v.views,
    likes: v.likes,
    created_at: v.createdAt,
    status: v.status,
    featured: v.featured,
  });
}

export async function backendDeleteShortVideo(id: string): Promise<void> {
  if (isLaravelConfigured()) {
    await laravelAdminDelete("videos", id);
    return;
  }
  await supabase!.from("short_videos").delete().eq("id", id);
}

export async function backendSaveTrendingPrompt(p: TrendingPrompt): Promise<void> {
  if (isLaravelConfigured()) {
    await laravelAdminSave("prompts", p as unknown as Record<string, unknown>);
    return;
  }
  await supabase!.from("trending_prompts").upsert({
    id: p.id,
    title: p.title,
    prompt: p.prompt,
    category: p.category,
    tool: p.tool,
    author: p.author,
    description: p.description,
    tags: p.tags,
    uses: p.uses,
    likes: p.likes,
    created_at: p.createdAt,
    status: p.status,
    featured: p.featured,
  });
}

export async function backendDeleteTrendingPrompt(id: string): Promise<void> {
  if (isLaravelConfigured()) {
    await laravelAdminDelete("prompts", id);
    return;
  }
  await supabase!.from("trending_prompts").delete().eq("id", id);
}

export async function backendIncrementDiscovery(id: string, kind: "view" | "use"): Promise<void> {
  if (isLaravelConfigured()) return;
  await supabase!.rpc(kind === "view" ? "increment_short_video_view" : "increment_prompt_use", {
    p_id: id,
  });
}

export async function backendIncrementLike(id: string, entity: "video" | "prompt"): Promise<void> {
  if (isLaravelConfigured()) return;
  await supabase!.rpc(entity === "video" ? "increment_short_video_like" : "increment_prompt_like", {
    p_id: id,
  });
}

export const backendNotes = {
  syncNotes: false,
  syncProgress: false,
};

/* ─────────────────────────── notifications ─────────────────────────── */

export async function backendLoadNotifications(): Promise<{
  items: NotificationItem[];
  unread: number;
} | null> {
  if (isLaravelConfigured()) return laravelLoadNotifications();
  return null;
}

export async function backendMarkNotificationRead(id: string): Promise<void> {
  if (isLaravelConfigured()) await laravelMarkNotificationRead(id);
}

export async function backendMarkAllNotificationsRead(): Promise<void> {
  if (isLaravelConfigured()) await laravelMarkAllNotificationsRead();
}

export async function backendDeleteNotification(id: string): Promise<void> {
  if (isLaravelConfigured()) await laravelDeleteNotification(id);
}
