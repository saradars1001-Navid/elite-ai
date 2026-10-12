import { CHAPTERS } from "./data";
import type {
  AiTool,
  AppUser,
  Chapter,
  CommunityPost,
  Lesson,
  ManagedUser,
  NotificationItem,
  PromptAttempt,
  PromptScenario,
  PromptTool,
  PurchaseRecord,
  Quiz,
  ShortVideo,
  TrendingPrompt,
  WalletTransaction,
} from "./types";

const configured = Boolean(import.meta.env.VITE_API_BASE_URL);
const baseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const TOKEN_KEY = "elite_ai_laravel_token";

type ApiUser = Record<string, unknown>;

export function isLaravelConfigured(): boolean {
  return configured;
}
export function laravelToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function clearLaravelToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * An HTTP status the server actually sent. Keeping it separate from the
 * plain `Error` thrown for transport failures (offline, DNS, refused
 * connection) lets callers tell "the API rejected this" from "the API is
 * unreachable" — only the former may destroy session state.
 */
class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  if (!configured) throw new Error("Laravel API is not configured");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = laravelToken();
  if (auth && token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.message || "خطا در ارتباط با API", response.status);
  return body as T;
}

function user(row: ApiUser): AppUser {
  return {
    id: String(row.id),
    phone: String(row.phone || ""),
    name: String(row.name || "کاربر"),
    role: row.role === "admin" ? "admin" : "user",
    joinedAt: String(row.created_at || new Date().toISOString()),
    points: Number(row.points || 0),
    xp: Number(row.xp || 0),
    streakDays: Number(row.streak_days || 0),
    lastActiveDate: String(row.last_active_date || ""),
  };
}

function chapter(row: ApiUser): Chapter {
  const id = String(row.id);
  // The shipped bundle is the source of truth for what the public catalog does
  // not expose (rating, students, exercises, exam questions, project) and for
  // offline use. The API still owns everything it actually returns — most
  // importantly lessons, whose content the server strips for locked chapters.
  const fallback = CHAPTERS.find((c) => c.id === id);
  const lessons = Array.isArray(row.lessons) ? (row.lessons as ApiUser[]) : [];
  const instructor = (row.instructor || {}) as ApiUser;
  const apiLessons: Lesson[] = lessons.map((l) => ({
    id: String(l.id),
    chapterId: String(l.chapter_id || id),
    index: Number(l.index || 0),
    title: String(l.title || ""),
    kind: l.kind === "video" ? "video" : "text",
    duration: Number(l.duration || 0),
    summary: String(l.summary || ""),
    // Never fall back to bundled content here: the server empties `content`
    // for lessons the viewer has not paid for, and that is the paywall.
    content: Array.isArray(l.content) ? (l.content as string[]) : [],
    captions: Array.isArray(l.captions) ? (l.captions as string[]) : undefined,
    free: Boolean(l.free),
  }));
  return {
    id,
    index: Number(row.index ?? fallback?.index ?? 0),
    title: String(row.title || fallback?.title || ""),
    subtitle: String(row.subtitle || fallback?.subtitle || ""),
    description: String(row.description || fallback?.description || ""),
    level: (row.level || fallback?.level || "مقدماتی") as Chapter["level"],
    instructor: {
      name: String(
        instructor.name || row.instructor_name || fallback?.instructor.name || "تیم آموزشی"
      ),
      role: String(instructor.role || row.instructor_role || fallback?.instructor.role || "مدرس"),
    },
    duration: Number(row.duration ?? row.duration_minutes ?? fallback?.duration ?? 0),
    price: Number(row.price ?? fallback?.price ?? 0),
    oldPrice: row.oldPrice == null ? fallback?.oldPrice : Number(row.oldPrice),
    free: row.free == null ? Boolean(fallback?.free) : Boolean(row.free),
    icon: String(row.icon || fallback?.icon || ""),
    gradient: String(row.gradient || fallback?.gradient || "from-sky/20 to-neon/5"),
    prerequisites: Array.isArray(row.prerequisites)
      ? (row.prerequisites as string[])
      : (fallback?.prerequisites ?? []),
    outcome: Array.isArray(row.outcome) ? (row.outcome as string[]) : (fallback?.outcome ?? []),
    completionRate: Number(row.completionRate ?? fallback?.completionRate ?? 0),
    rating: Number(row.rating ?? fallback?.rating ?? 0),
    students: Number(row.students ?? fallback?.students ?? 0),
    previewCount: Number(row.previewCount ?? fallback?.previewCount ?? 1),
    lessons: apiLessons.length ? apiLessons : (fallback?.lessons ?? []),
    exercises: fallback?.exercises ?? [],
    exam: fallback?.exam ?? {
      id: `exam-${id}`,
      chapterId: id,
      title: "آزمون پایان فصل",
      durationMinutes: 20,
      passScore: 70,
      questions: [],
    },
    project: fallback?.project ?? {
      title: "پروژه نهایی",
      description: "پروژه عملی فصل",
      tasks: [],
      tools: [],
      deliverable: "",
    },
  };
}

function quiz(row: ApiUser): Quiz {
  const questions = Array.isArray(row.questions) ? (row.questions as ApiUser[]) : [];
  return {
    id: String(row.id),
    kind: (row.kind || "category") as Quiz["kind"],
    title: String(row.title || ""),
    category: String(row.category || "عمومی"),
    difficulty: (row.difficulty || "آسان") as Quiz["difficulty"],
    durationSeconds: Number(row.durationSeconds || row.duration_seconds || 90),
    pointsPerQuestion: Number(row.pointsPerQuestion || row.points_per_question || 10),
    questions: questions.map((q) => ({
      id: String(q.id),
      text: String(q.text || ""),
      options: Array.isArray(q.options) ? (q.options as string[]) : [],
      correct: Number(q.correct || 0),
      explanation: String(q.explanation || ""),
    })),
  };
}

function tool(row: ApiUser): AiTool {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    tagline: String(row.tagline || ""),
    description: String(row.description || ""),
    category: String(row.category || ""),
    useCases: Array.isArray(row.use_cases) ? (row.use_cases as string[]) : [],
    level: (row.level || "متوسط") as AiTool["level"],
    pricing: (row.pricing || "رایگان + پولی") as AiTool["pricing"],
    languages: Array.isArray(row.languages) ? (row.languages as string[]) : [],
    url: String(row.url || ""),
    rating: Number(row.rating || 0),
    reviews: Number(row.reviews || 0),
    relatedLessons: Array.isArray(row.related_lessons) ? (row.related_lessons as string[]) : [],
    reviewedAt: String(row.reviewed_at || ""),
    isNew: Boolean(row.is_new),
    output: "",
  };
}

function video(row: ApiUser): ShortVideo {
  return {
    id: String(row.id),
    title: String(row.title || ""),
    creator: String(row.creator || ""),
    creatorRole: String(row.creator_role || ""),
    category: String(row.category || ""),
    description: String(row.description || ""),
    videoUrl: String(row.video_path || ""),
    posterUrl: row.poster_path ? String(row.poster_path) : undefined,
    durationSeconds: Number(row.duration_seconds || 0),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    views: Number(row.views || 0),
    likes: Number(row.likes || 0),
    createdAt: String(row.created_at || ""),
    status: row.status as ShortVideo["status"],
    featured: Boolean(row.featured),
  };
}
function prompt(row: ApiUser): TrendingPrompt {
  return {
    id: String(row.id),
    title: String(row.title || ""),
    prompt: String(row.prompt || ""),
    category: row.category as TrendingPrompt["category"],
    tool: String(row.tool || ""),
    author: String(row.author || ""),
    description: String(row.description || ""),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    uses: Number(row.uses || 0),
    likes: Number(row.likes || 0),
    createdAt: String(row.created_at || ""),
    status: row.status as TrendingPrompt["status"],
    featured: Boolean(row.featured),
  };
}

export async function laravelRequestOtp(
  phone: string
): Promise<{ ok: boolean; error?: string; debugCode?: string }> {
  try {
    const result = await request<{ ok: boolean; debugCode?: string }>(
      "/auth/otp/request",
      { method: "POST", body: JSON.stringify({ phone }) },
      false
    );
    return { ok: true, debugCode: result.debugCode };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "خطا در ارسال کد" };
  }
}
export async function laravelVerifyOtp(
  phone: string,
  code: string,
  name?: string
): Promise<{ ok: boolean; error?: string; userId?: string; profileName?: string | null }> {
  try {
    const result = await request<{ token: string; user: ApiUser }>(
      "/auth/otp/verify",
      { method: "POST", body: JSON.stringify({ phone, code, name }) },
      false
    );
    localStorage.setItem(TOKEN_KEY, result.token);
    const profileName =
      result.user.name && result.user.name !== "کاربر" ? String(result.user.name) : null;
    return { ok: true, userId: String(result.user.id), profileName };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "خطا در ورود" };
  }
}
export async function laravelLoadUser(): Promise<AppUser | null> {
  if (!laravelToken()) return null;
  try {
    const result = await request<{ user: ApiUser }>("/me");
    return user(result.user);
  } catch (e) {
    // Only the server declaring the token dead may end the session. A dropped
    // connection, a timeout or a 5xx must not wipe it — otherwise a single
    // offline load would silently sign the user out for good, and they would
    // need a fresh SMS code to get back in.
    if (e instanceof ApiError && e.status === 401) {
      clearLaravelToken();
    }
    return null;
  }
}
export async function laravelSetName(name: string): Promise<AppUser> {
  const result = await request<{ user: ApiUser }>("/profile", {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return user(result.user);
}
export async function laravelLogout(): Promise<void> {
  try {
    await request("/auth/session", { method: "DELETE" });
  } finally {
    clearLaravelToken();
  }
}
export async function laravelAccessMap(): Promise<Record<string, boolean>> {
  const result = await request<{ chapterIds: string[] }>("/access");
  return Object.fromEntries(result.chapterIds.map((id) => [id, true]));
}
export async function laravelLoadPromptLab(): Promise<{
  promptTools: PromptTool[];
  promptScenarios: PromptScenario[];
}> {
  const result = await request<{ promptTools: ApiUser[]; promptScenarios: ApiUser[] }>(
    "/prompt-lab",
    {},
    false
  );
  return {
    promptTools: result.promptTools.map((row) => ({
      id: String(row.id),
      name: String(row.name || ""),
      emoji: String(row.emoji || ""),
      category: String(row.category || ""),
      description: String(row.description || ""),
      style: String(row.style || ""),
    })),
    promptScenarios: result.promptScenarios.map((row) => ({
      id: String(row.id),
      title: String(row.title || ""),
      description: String(row.description || ""),
      category: String(row.category || ""),
      taskType: row.task_type as PromptScenario["taskType"],
      toolIds: Array.isArray(row.tool_ids) ? (row.tool_ids as string[]) : [],
      samplePrompt: String(row.sample_prompt || ""),
      goal: String(row.goal || ""),
      timeSeconds: Number(row.time_seconds || 60),
      points: Number(row.points || 100),
    })),
  };
}
export async function laravelSubmitPromptAttempt(attempt: PromptAttempt): Promise<void> {
  await request("/prompt-lab/attempts", {
    method: "POST",
    body: JSON.stringify({
      scenarioId: attempt.scenarioId,
      prompt: attempt.prompt,
      maxScore: attempt.maxScore,
      criteria: attempt.criteria,
      toolResults: attempt.toolResults,
    }),
  });
}
export async function laravelLoadCatalog(): Promise<{
  chapters: Chapter[];
  quizzes: Quiz[];
  aiTools: AiTool[];
}> {
  // Authenticated on purpose: the API strips lesson content for chapters the
  // viewer has not paid for, and it can only know the viewer from the token.
  const result = await request<{ chapters: ApiUser[]; quizzes: ApiUser[]; aiTools: ApiUser[] }>(
    "/catalog",
    {}
  );
  return {
    chapters: result.chapters.map(chapter),
    quizzes: result.quizzes.map(quiz),
    aiTools: result.aiTools.map(tool),
  };
}
export async function laravelLoadDiscovery(): Promise<{
  shortVideos: ShortVideo[];
  trendingPrompts: TrendingPrompt[];
}> {
  const result = await request<{ shortVideos: ApiUser[]; trendingPrompts: ApiUser[] }>(
    "/discovery",
    {},
    false
  );
  return {
    shortVideos: result.shortVideos.map(video),
    trendingPrompts: result.trendingPrompts.map(prompt),
  };
}
export async function laravelLoadCommunity(): Promise<CommunityPost[]> {
  const result = await request<{ data?: ApiUser[] }>("/community/posts", {}, false);
  return (result.data || []).map((row) => {
    const author = (row.author || {}) as ApiUser;
    return {
      id: String(row.id),
      author: {
        name: String(row.author_name || author.name || "کاربر"),
        role: String(row.author_role || author.role || "کاربر"),
        expert:
          row.author_role === "instructor" ||
          author.role === "instructor" ||
          String(row.author_role || author.role || "").includes("مدرس"),
      },
      category: String(row.category || ""),
      title: String(row.title || ""),
      body: String(row.body || ""),
      tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
      createdAt: String(row.created_at || ""),
      likes: Number(row.likes || 0),
      commentsCount: Number(row.comments_count || 0),
      status: row.status === "closed" ? "closed" : "open",
    };
  });
}
export async function laravelLoadAdminUsers(): Promise<ManagedUser[]> {
  const result = await request<{ users: { data?: ApiUser[] } }>("/admin/users");
  return (result.users.data || []).map((row) => ({
    id: String(row.id),
    name: String(row.name || ""),
    phone: String(row.phone || ""),
    role: row.role === "admin" ? "admin" : "user",
    label: row.role === "instructor" ? "مدرس" : "کاربر",
    color: "#3B82F6",
    joinedAt: String(row.created_at || ""),
    status: row.status === "blocked" ? "غیرفعال" : "فعال",
    purchases: 0,
  }));
}
export async function laravelAdminSaveUser(user: ManagedUser): Promise<void> {
  const path = user.id ? `/admin/users/${encodeURIComponent(user.id)}` : "/admin/users";
  await request(path, {
    method: user.id ? "PATCH" : "POST",
    body: JSON.stringify({
      name: user.name,
      phone: user.phone,
      role: user.role,
      status: user.status === "فعال" ? "active" : "blocked",
    }),
  });
}
export async function laravelAdminDeleteUser(id: string): Promise<void> {
  await request(`/admin/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "blocked" }),
  });
}
export async function laravelSearchUsers(query: string): Promise<ApiUser[]> {
  const result = await request<{ users: ApiUser[] }>(
    `/users/search?q=${encodeURIComponent(query)}`
  );
  return result.users;
}
export async function laravelLeaderboard(): Promise<ApiUser[]> {
  const result = await request<{ users: ApiUser[] }>("/leaderboard", {}, false);
  return result.users;
}
export async function laravelSubmitQuiz(
  quizId: string,
  answers: number[],
  durationSeconds: number
): Promise<{ score: number; total: number; correct: number }> {
  return request(`/quizzes/${encodeURIComponent(quizId)}/attempts`, {
    method: "POST",
    body: JSON.stringify({ answers, durationSeconds }),
  });
}

/**
 * Grade a chapter exam server-side. The backend recomputes the score from the
 * answer indices, records the attempt and sends the result + performance
 * discount notification (in-app + SMS) through NotificationService. Returns
 * null when the backend is unreachable — callers keep their local result.
 */
export async function laravelSubmitExam(
  chapterId: string,
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
  try {
    return await request(`/exams/${encodeURIComponent(chapterId)}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  } catch {
    return null;
  }
}
export interface LiveMatchQuestion {
  text: string;
  options: string[];
  /** Secret while the match is live — the server reveals it once finished. */
  correct?: number;
  explanation?: string;
  /** The viewer's own graded pick — only present after the match has finished. */
  myAnswer?: number | null;
}
export interface LiveMatchPlayer {
  id: string;
  name: string;
  score: number;
  correct: number;
  answeredCount: number;
  rank: number | null;
  isViewer: boolean;
}
export interface LiveMatchState {
  id: number;
  mode: "1v1" | "ffa";
  maxPlayers: number;
  status: "waiting" | "playing" | "finished" | "abandoned";
  hostId: string;
  questions: LiveMatchQuestion[];
  questionIndex: number;
  pointsPerQuestion: number;
  secondsPerQuestion: number;
  questionEndsAt: string | null;
  players: LiveMatchPlayer[];
}
export interface LiveMatchLobbyRow {
  id: number;
  mode: "1v1" | "ffa";
  maxPlayers: number;
  players: number;
  host: string;
  createdAt: string;
}

export async function laravelCreateMatch(mode: "1v1" | "ffa"): Promise<LiveMatchState> {
  const r = await request<{ match: LiveMatchState }>("/live-matches", {
    method: "POST",
    body: JSON.stringify({ mode }),
  });
  return r.match;
}
export async function laravelJoinMatch(matchId: number): Promise<LiveMatchState> {
  const r = await request<{ match: LiveMatchState }>(`/live-matches/${matchId}/join`, {
    method: "POST",
  });
  return r.match;
}
export async function laravelStartMatch(matchId: number): Promise<LiveMatchState> {
  const r = await request<{ match: LiveMatchState }>(`/live-matches/${matchId}/start`, {
    method: "POST",
  });
  return r.match;
}
export async function laravelRematch(matchId: number): Promise<LiveMatchState> {
  const r = await request<{ match: LiveMatchState }>(`/live-matches/${matchId}/rematch`, {
    method: "POST",
  });
  return r.match;
}
export async function laravelMatchState(matchId: number): Promise<LiveMatchState> {
  const r = await request<{ match: LiveMatchState }>(`/live-matches/${matchId}`);
  return r.match;
}
export async function laravelSubmitAnswer(
  matchId: number,
  answer: number,
  questionIndex: number
): Promise<LiveMatchState> {
  const r = await request<{ match: LiveMatchState }>(`/live-matches/${matchId}/answer`, {
    method: "POST",
    body: JSON.stringify({ answer, questionIndex }),
  });
  return r.match;
}
export async function laravelMatchLobby(): Promise<LiveMatchLobbyRow[]> {
  const r = await request<{ matches: LiveMatchLobbyRow[] }>("/live-matches/lobby");
  return r.matches;
}

export interface CheckoutResult {
  purchaseId?: string;
  amount?: number;
  checkoutUrl?: string | null;
  walletPaid?: boolean;
  error?: string;
}

export interface WalletInfo {
  balance: number;
  transactions: WalletTransaction[];
}
export interface ChargeResult {
  transactionId?: string;
  amount?: number;
  checkoutUrl?: string | null;
  error?: string;
}
export interface PurchaseStatus {
  id: string;
  chapterId: string;
  status: string;
  price: number;
  basePrice: number;
  discountLabel: string | null;
  receiptId: string | null;
  refundStatus?: "none" | "pending" | "refunded" | "rejected";
  refundReason?: string | null;
  refundRequestedAt?: string | null;
  createdAt: string;
}

export async function laravelCreateCheckout(
  chapterId: string,
  couponCode?: string,
  paymentMethod?: "gateway" | "wallet"
): Promise<CheckoutResult> {
  try {
    const result = await request<{
      purchaseId?: string;
      amount?: number;
      checkoutUrl?: string | null;
      walletPaid?: boolean;
      message?: string;
    }>("/checkout", {
      method: "POST",
      body: JSON.stringify({ chapterId, couponCode, paymentMethod }),
    });
    if (result.message) return { error: result.message };
    return {
      purchaseId: result.purchaseId,
      amount: result.amount,
      checkoutUrl: result.checkoutUrl ?? null,
      walletPaid: Boolean(result.walletPaid),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در ایجاد سفارش" };
  }
}
export async function laravelWalletInfo(): Promise<WalletInfo> {
  const r = await request<{ balance: number; transactions: ApiUser[] }>("/wallet");
  return {
    balance: Number(r.balance || 0),
    transactions: (r.transactions || []).map((t) => ({
      id: String(t.id),
      type: t.type as WalletTransaction["type"],
      amount: Number(t.amount || 0),
      balanceAfter: Number(t.balance_after || 0),
      status: t.status as WalletTransaction["status"],
      description: String(t.description || ""),
      createdAt: String(t.created_at || ""),
    })),
  };
}
export async function laravelChargeWallet(amount: number): Promise<ChargeResult> {
  try {
    const result = await request<{
      transactionId?: number;
      amount?: number;
      checkoutUrl?: string | null;
      message?: string;
    }>("/wallet/charge", { method: "POST", body: JSON.stringify({ amount }) });
    if (result.message) return { error: result.message };
    return {
      transactionId: result.transactionId != null ? String(result.transactionId) : undefined,
      amount: result.amount,
      checkoutUrl: result.checkoutUrl ?? null,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "خطا در شارژ کیف پول" };
  }
}
export async function laravelPurchaseStatus(purchaseId: string): Promise<PurchaseStatus | null> {
  try {
    const r = await request<{ purchase: PurchaseStatus }>(
      `/checkout/${encodeURIComponent(purchaseId)}`
    );
    return r.purchase;
  } catch {
    return null;
  }
}
export async function laravelRefundPurchase(
  purchaseId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await request(`/checkout/${encodeURIComponent(purchaseId)}/refund`, { method: "POST" });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "بازگشت وجه ناموفق بود" };
  }
}

/** Buyer asks for a refund on one of their own paid purchases. */
export async function laravelRequestRefund(
  purchaseId: string,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await request(`/checkout/${encodeURIComponent(purchaseId)}/refund-request`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "ثبت درخواست بازگشت وجه ناموفق بود",
    };
  }
}

/** Map a Laravel purchase row into the frontend purchase record shape. */
export function laravelPurchaseToRecord(p: PurchaseStatus, chapterTitle?: string): PurchaseRecord {
  const statusMap: Record<string, PurchaseRecord["status"]> = {
    paid: "موفق",
    failed: "ناموفق",
    pending: "در انتظار",
    cancelled: "لغوشده",
    refunded: "لغوشده",
  };
  return {
    id: p.id,
    chapterId: p.chapterId,
    chapterTitle: chapterTitle || "فصل",
    price: p.price,
    basePrice: p.basePrice,
    discountLabel: p.discountLabel || "",
    status: statusMap[p.status] ?? "در انتظار",
    date: p.createdAt,
    receiptId: p.receiptId || p.id,
    refundStatus: p.refundStatus ?? "none",
    refundReason: p.refundReason ?? undefined,
    refundRequestedAt: p.refundRequestedAt ?? undefined,
  };
}

export async function laravelSearch(
  query: string
): Promise<{ type: string; id: string; title: string; description?: string; url: string }[]> {
  const result = await request<{
    results: { type: string; id: string; title: string; description?: string; url: string }[];
  }>(`/search?q=${encodeURIComponent(query)}`, {}, false);
  return result.results;
}

/* ─────────────────────────── notifications ─────────────────────────── */

type ApiNotification = Record<string, unknown> & {
  id?: unknown;
  type?: unknown;
  title?: unknown;
  body?: unknown;
  read?: unknown;
  createdAt?: unknown;
  link?: unknown;
};

const NOTIFICATION_TYPES: NotificationItem["type"][] = [
  "chapter",
  "lesson",
  "quiz",
  "discount",
  "exam",
  "badge",
  "community",
  "support",
  "payment",
];

function notification(row: ApiNotification): NotificationItem {
  const t = String(row.type || "support");
  return {
    id: String(row.id || ""),
    type: NOTIFICATION_TYPES.includes(t as NotificationItem["type"])
      ? (t as NotificationItem["type"])
      : "support",
    title: String(row.title || ""),
    body: String(row.body || ""),
    createdAt: String(row.createdAt || new Date().toISOString()),
    read: Boolean(row.read),
    link: row.link ? String(row.link) : undefined,
  };
}

export async function laravelLoadNotifications(): Promise<{
  items: NotificationItem[];
  unread: number;
}> {
  const result = await request<{ notifications: ApiNotification[]; unread: number }>(
    "/notifications"
  );
  return {
    items: (result.notifications || []).map(notification),
    unread: Number(result.unread || 0),
  };
}

export async function laravelMarkNotificationRead(id: string): Promise<void> {
  await request(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
}

export async function laravelMarkAllNotificationsRead(): Promise<void> {
  await request("/notifications/read-all", { method: "PATCH" });
}

export async function laravelDeleteNotification(id: string): Promise<void> {
  await request(`/notifications/${encodeURIComponent(id)}`, { method: "DELETE" });
}
