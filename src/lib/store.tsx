import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  AiTool,
  AppUser,
  Chapter,
  CommunityComment,
  CommunityPost,
  Discount,
  ExamAttempt,
  LessonQuestion,
  LiveMatchResult,
  ManagedUser,
  Note,
  NotificationItem,
  PromptAttempt,
  PromptScenario,
  PromptTool,
  PurchaseRecord,
  QuestionBankEntry,
  Quiz,
  QuizAttempt,
  Role,
  SiteSettings,
  ShortVideo,
  TrendingPrompt,
  WalletTransaction,
} from "./types";
import {
  AI_TOOLS,
  CHAPTERS,
  COMMUNITY_COMMENTS,
  COMMUNITY_POSTS,
  COUPONS,
  DEFAULT_DISCOUNT_RULES,
  DEFAULT_SITE,
  NOTIFICATIONS,
  PROMPT_SCENARIOS,
  PROMPT_TOOLS,
  QUESTION_BANK,
  QUIZZES,
  SEED_PURCHASES,
  SEED_USERS,
  WEEKLY_CHALLENGES,
  SHORT_VIDEOS,
  TRENDING_PROMPTS,
  levelFromXp,
  type DiscountRules,
  type LevelInfo,
  type WeeklyChallengeDef,
} from "./data";
import { uid } from "./utils";
import {
  backendAccessMap,
  backendCreatePurchase,
  backendSaveChapter,
  backendDeleteChapter,
  backendSaveQuiz,
  backendDeleteQuiz,
  backendSaveAiTool,
  backendDeleteAiTool,
  backendCreateComment,
  backendCreateNote,
  backendCreatePost,
  backendDeleteNote,
  backendDeletePromptScenario,
  backendDeletePromptTool,
  backendEnabled,
  backendGrantAccess,
  backendAskQuestion,
  backendSubmitExercise,
  backendSubmitExam,
  backendSubmitQuiz,
  backendSubmitPromptAttempt,
  backendSavePromptScenario,
  backendSavePromptTool,
  backendTogglePostLike,
  backendToggleSavedPost,
  backendUpsertLessonProgress,
  backendLoadCatalog,
  backendLoadCommunity,
  backendLoadManagedUsers,
  backendLoadDiscovery,
  backendLoadPromptLab,
  backendSaveShortVideo,
  backendDeleteShortVideo,
  backendSaveTrendingPrompt,
  backendDeleteTrendingPrompt,
  backendIncrementDiscovery,
  backendIncrementLike,
  backendFetchPurchaseStatus,
  backendRequestRefund,
  backendLoadUser,
  backendAdminDeleteUser,
  backendAdminSaveUser,
  backendRequestOtp,
  backendSetName,
  backendSignOut,
  backendTouchActivity,
  backendVerifyOtp,
  backendWalletInfo,
  backendChargeWallet,
  backendLoadNotifications,
  backendMarkNotificationRead,
  backendMarkAllNotificationsRead,
  backendDeleteNotification,
} from "./backend";

/* ──────────────────────────────── Persisted state ──────────────────────── */

interface PersistedState {
  user: AppUser | null;
  phone: string | null;
  purchases: PurchaseRecord[];
  accessGrants: string[];
  accessMap: Record<string, boolean>; // backend-backed chapter access cache
  lessonProgress: Record<string, Record<string, boolean>>;
  exerciseSubmissions: Record<
    string,
    { status: string; answer: string; score: number; submittedAt: string }
  >;
  examAttempts: ExamAttempt[];
  quizAttempts: QuizAttempt[];
  dailyQuizDates: string[];
  notes: Note[];
  lessonQuestions: LessonQuestion[];
  notifications: NotificationItem[];
  postLikes: Record<string, number>;
  savedPosts: string[];
  userPosts: CommunityPost[];
  userComments: CommunityComment[];
  discountRules: DiscountRules;
  usedDiscountCodes: string[];
  points: number;
  xp: number;
  streak: number;
  lastActiveDate: string;
  reportCounts: Record<string, number>;
  /* leveling & live matches */
  weekly: { weekKey: string; tasks: Record<string, number> };
  weeklyClaimed: Record<string, string[]>;
  matchHistory: LiveMatchResult[];
  /* dynamic content — seeded from data.ts, edited through the admin panel */
  chapters: Chapter[];
  quizzes: Quiz[];
  aiTools: AiTool[];
  communityPosts: CommunityPost[];
  communityComments: CommunityComment[];
  managedUsers: ManagedUser[];
  site: SiteSettings;
  coupons: Record<string, number>;
  questionBank: QuestionBankEntry[];
  allPurchases: PurchaseRecord[];
  /* prompt lab */
  promptTools: PromptTool[];
  promptScenarios: PromptScenario[];
  promptAttempts: PromptAttempt[];
  shortVideos: ShortVideo[];
  trendingPrompts: TrendingPrompt[];
  /* wallet */
  walletBalance: number;
  walletTransactions: WalletTransaction[];
}

const initialState: PersistedState = {
  user: null,
  phone: null,
  purchases: [],
  accessGrants: [],
  accessMap: {},
  lessonProgress: {},
  exerciseSubmissions: {},
  examAttempts: [],
  quizAttempts: [],
  dailyQuizDates: [],
  notes: [],
  lessonQuestions: [],
  notifications: [],
  postLikes: {},
  savedPosts: [],
  userPosts: [],
  userComments: [],
  discountRules: DEFAULT_DISCOUNT_RULES,
  usedDiscountCodes: [],
  points: 0,
  xp: 0,
  streak: 0,
  lastActiveDate: "",
  reportCounts: {},
  weekly: { weekKey: "", tasks: {} },
  weeklyClaimed: {},
  matchHistory: [],
  chapters: [...CHAPTERS],
  quizzes: [...QUIZZES],
  aiTools: [...AI_TOOLS],
  communityPosts: [...COMMUNITY_POSTS],
  communityComments: [...COMMUNITY_COMMENTS],
  managedUsers: [...SEED_USERS],
  site: { ...DEFAULT_SITE },
  coupons: { ...COUPONS },
  questionBank: [...QUESTION_BANK],
  allPurchases: [...SEED_PURCHASES],
  promptTools: [...PROMPT_TOOLS],
  promptScenarios: [...PROMPT_SCENARIOS],
  promptAttempts: [],
  shortVideos: [...SHORT_VIDEOS],
  trendingPrompts: [...TRENDING_PROMPTS],
  walletBalance: 125000,
  walletTransactions: [],
};

const STORAGE_KEY = "eaa:v1";

/* ─────────────────────────── Leveling helpers ──────────────────────────── */

/** ISO week key (week starts on Monday), e.g. "2026-W32". */
function weekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Monday = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    );
  return `${date.getUTCFullYear()}-W${week}`;
}

/** Add XP to both the top-level counter and the live user object. */
function withXp(s: PersistedState, n: number): PersistedState {
  if (n === 0) return s;
  return { ...s, xp: s.xp + n, user: s.user ? { ...s.user, xp: s.xp + n } : s.user };
}

/** Count an activity toward the current week's challenges. */
function bumpWeekly(s: PersistedState, type: string): PersistedState {
  const key = weekKey();
  const tasks = s.weekly.weekKey === key ? s.weekly.tasks : {};
  return {
    ...s,
    weekly: { weekKey: key, tasks: { ...tasks, [type]: (tasks[type] || 0) + 1 } },
  };
}

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = { ...initialState, ...JSON.parse(raw) } as PersistedState;
    if (!parsed.notifications.length) parsed.notifications = [...NOTIFICATIONS];
    if (!parsed.chapters?.length) parsed.chapters = [...CHAPTERS];
    if (!parsed.quizzes?.length) parsed.quizzes = [...QUIZZES];
    if (!parsed.aiTools?.length) parsed.aiTools = [...AI_TOOLS];
    if (!parsed.communityPosts?.length) parsed.communityPosts = [...COMMUNITY_POSTS];
    if (!parsed.communityComments?.length) parsed.communityComments = [...COMMUNITY_COMMENTS];
    if (!parsed.managedUsers?.length) parsed.managedUsers = [...SEED_USERS];
    if (!parsed.site) parsed.site = { ...DEFAULT_SITE };
    if (!parsed.coupons) parsed.coupons = { ...COUPONS };
    if (!parsed.questionBank?.length) parsed.questionBank = [...QUESTION_BANK];
    if (!parsed.allPurchases?.length) parsed.allPurchases = [...SEED_PURCHASES];
    if (!parsed.promptTools?.length) parsed.promptTools = [...PROMPT_TOOLS];
    if (!parsed.promptScenarios?.length) parsed.promptScenarios = [...PROMPT_SCENARIOS];
    if (!parsed.promptAttempts?.length) parsed.promptAttempts = [];
    if (!parsed.shortVideos?.length) parsed.shortVideos = [...SHORT_VIDEOS];
    if (!parsed.trendingPrompts?.length) parsed.trendingPrompts = [...TRENDING_PROMPTS];
    // migrate legacy user-created posts/comments into the unified collections
    const legacy = raw
      ? (JSON.parse(raw) as { userPosts?: CommunityPost[]; userComments?: CommunityComment[] })
      : {};
    if (legacy.userPosts?.length)
      parsed.communityPosts = [...legacy.userPosts, ...parsed.communityPosts];
    if (legacy.userComments?.length)
      parsed.communityComments = [...legacy.userComments, ...parsed.communityComments];
    return parsed;
  } catch {
    return initialState;
  }
}

/* ────────────────────────────────── Context ────────────────────────────── */

interface AppContextValue {
  state: PersistedState;
  user: AppUser | null;
  /* auth */
  otpSent: boolean;
  requestOtp: (phone: string) => Promise<{ ok: boolean; error?: string }>;
  verifyOtp: (
    code: string,
    name?: string
  ) => Promise<{ ok: boolean; error?: string; needsName?: boolean }>;
  logout: () => void;
  /* access */
  hasAccess: (chapterId: string) => boolean;
  canViewLesson: (lessonId: string) => boolean;
  buyChapter: (chapterId: string, method: string, couponCode?: string) => PurchaseRecord;
  grantAccess: (chapterId: string) => void;
  /* progress */
  isLessonComplete: (lessonId: string) => boolean;
  toggleLessonComplete: (lessonId: string) => void;
  submitExercise: (exerciseId: string, answer: string, score: number) => void;
  getExerciseStatus: (
    exerciseId: string
  ) => { status: string; answer: string; score: number; submittedAt: string } | undefined;
  /* exam */
  submitExam: (examId: string, answers: (number | null)[]) => ExamAttempt;
  /* quiz */
  submitQuiz: (
    quizId: string,
    score: number,
    total: number,
    answers?: number[],
    durationSeconds?: number
  ) => void;
  isDailyQuizDone: (date: string) => boolean;
  /* leveling & live matches */
  xp: number;
  level: LevelInfo;
  weeklyChallenge: {
    weekKey: string;
    tasks: Record<string, number>;
    challenges: { def: WeeklyChallengeDef; progress: number; claimed: boolean; ready: boolean }[];
    done: number;
    total: number;
  };
  claimWeeklyReward: (challengeId: string) => void;
  submitMatch: (r: Omit<LiveMatchResult, "id" | "date">) => void;
  matchStats: { wins: number; total: number; best: number | null };
  /* notifications */
  markAllRead: () => void;
  markOneRead: (id: string) => void;
  unreadCount: number;
  /* community */
  toggleLike: (postId: string) => void;
  toggleSave: (postId: string) => void;
  addPost: (title: string, body: string, category: string, tags: string[]) => void;
  addComment: (postId: string, body: string) => void;
  reportPost: (postId: string) => void;
  /* notes & questions */
  addNote: (lessonId: string, lessonTitle: string, text: string) => void;
  deleteNote: (noteId: string) => void;
  askQuestion: (lessonId: string, text: string) => void;
  /* admin */
  setDiscountRules: (rules: DiscountRules) => void;
  updateNotifications: (items: NotificationItem[]) => void;
  addNotification: (n: Omit<NotificationItem, "id" | "read" | "createdAt">) => void;
  deleteNotification: (id: string) => void;
  deleteUser: (userId: string) => void;
  /* dynamic content collections */
  chapters: Chapter[];
  quizzes: Quiz[];
  aiTools: AiTool[];
  communityPosts: CommunityPost[];
  communityComments: CommunityComment[];
  managedUsers: ManagedUser[];
  site: SiteSettings;
  coupons: Record<string, number>;
  questionBank: QuestionBankEntry[];
  allPurchases: PurchaseRecord[];
  /* chapters CRUD */
  saveChapter: (ch: Chapter) => void;
  deleteChapter: (id: string) => void;
  /* quizzes CRUD + auto generation */
  saveQuiz: (q: Quiz) => void;
  deleteQuiz: (id: string) => void;
  generateQuiz: (opts: {
    kind: "daily" | "weekly" | "category";
    category: string;
    difficulty: "آسان" | "متوسط" | "سخت";
    title: string;
    count: number;
    durationSeconds?: number;
    replaceId?: string;
  }) => Quiz;
  /* tools CRUD */
  saveTool: (t: AiTool) => void;
  deleteTool: (id: string) => void;
  /* community moderation */
  deletePost: (id: string) => void;
  setPostStatus: (id: string, status: "open" | "closed") => void;
  deleteComment: (id: string) => void;
  clearReport: (id: string) => void;
  /* users CRUD */
  saveManagedUser: (u: ManagedUser) => void;
  deleteManagedUser: (id: string) => void;
  /* site settings + coupons + question bank */
  updateSite: (patch: Partial<SiteSettings>) => void;
  setCoupons: (c: Record<string, number>) => void;
  saveQuestion: (q: QuestionBankEntry) => void;
  deleteQuestion: (id: string) => void;
  /* payments */
  updatePurchase: (id: string, status: PurchaseRecord["status"]) => void;
  syncPurchase: (p: PurchaseRecord) => void;
  refreshPurchaseStatus: (purchaseId: string) => Promise<void>;
  setPurchaseRefund: (id: string, patch: Partial<PurchaseRecord>) => void;
  requestRefund: (purchaseId: string, reason?: string) => Promise<{ ok: boolean; error?: string }>;
  /* wallet */
  walletBalance: number;
  walletTransactions: WalletTransaction[];
  chargeWallet: (
    amount: number
  ) => Promise<{ ok: boolean; checkoutUrl?: string | null; error?: string }>;
  refreshWallet: () => Promise<void>;
  /* prompt lab */
  promptTools: PromptTool[];
  promptScenarios: PromptScenario[];
  promptAttempts: PromptAttempt[];
  shortVideos: ShortVideo[];
  trendingPrompts: TrendingPrompt[];
  savePromptTool: (t: PromptTool) => void;
  deletePromptTool: (id: string) => void;
  savePromptScenario: (s: PromptScenario) => void;
  deletePromptScenario: (id: string) => void;
  saveShortVideo: (v: ShortVideo) => void;
  deleteShortVideo: (id: string) => void;
  incrementShortVideoEngagement: (id: string, kind: "view" | "like") => void;
  saveTrendingPrompt: (p: TrendingPrompt) => void;
  deleteTrendingPrompt: (id: string) => void;
  incrementPromptEngagement: (id: string, kind: "use" | "like") => void;
  submitPromptLab: (a: Omit<PromptAttempt, "id" | "createdAt">) => PromptAttempt;
  /* helpers */
  activeDiscount: Discount | null;
  bestExamScore: (chapterId: string) => number;
  chapterProgress: (chapterId: string) => number;
  overallProgress: number;
  earnedBadges: string[];
  isDemoUser: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadState);
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }, [state]);

  /* Restore a real Supabase session on page load (backend mode only). */
  useEffect(() => {
    if (!backendEnabled()) return;
    let alive = true;
    (async () => {
      const [catalog, discovery, promptLab, remoteCommunity] = await Promise.all([
        backendLoadCatalog().catch(() => ({ chapters: [], quizzes: [], aiTools: [] })),
        backendLoadDiscovery().catch(() => ({ shortVideos: [], trendingPrompts: [] })),
        backendLoadPromptLab().catch(() => ({ promptTools: [], promptScenarios: [] })),
        backendLoadCommunity().catch(() => []),
      ]);
      if (
        alive &&
        (catalog.chapters.length ||
          catalog.quizzes.length ||
          catalog.aiTools.length ||
          discovery.shortVideos.length ||
          discovery.trendingPrompts.length ||
          promptLab.promptTools.length ||
          promptLab.promptScenarios.length)
      ) {
        setState((s) => ({
          ...s,
          chapters: catalog.chapters.length ? catalog.chapters : s.chapters,
          quizzes: catalog.quizzes.length ? catalog.quizzes : s.quizzes,
          aiTools: catalog.aiTools.length ? catalog.aiTools : s.aiTools,
          shortVideos: discovery.shortVideos.length ? discovery.shortVideos : s.shortVideos,
          trendingPrompts: discovery.trendingPrompts.length
            ? discovery.trendingPrompts
            : s.trendingPrompts,
          communityPosts: remoteCommunity.length ? remoteCommunity : s.communityPosts,
          promptTools: promptLab.promptTools.length ? promptLab.promptTools : s.promptTools,
          promptScenarios: promptLab.promptScenarios.length
            ? promptLab.promptScenarios
            : s.promptScenarios,
        }));
      }
      const appUser = await backendLoadUser();
      if (!alive) return;
      if (appUser) {
        const access = await backendAccessMap(appUser.id);
        await backendTouchActivity(appUser.id);
        if (alive) {
          setState((s) => ({ ...s, user: appUser, accessMap: access }));
          void refreshWallet();
          const remoteNotifications = await backendLoadNotifications().catch(() => null);
          if (alive && remoteNotifications && remoteNotifications.items.length) {
            setState((s) => ({ ...s, notifications: remoteNotifications.items }));
          }
        }
        if (appUser.role === "admin") {
          const remoteUsers = await backendLoadManagedUsers().catch(() => []);
          if (alive && remoteUsers.length) setState((s) => ({ ...s, managedUsers: remoteUsers }));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ---------- auth ---------- */

  const requestOtp = async (phone: string) => {
    setState((s) => ({ ...s, phone }));
    if (backendEnabled()) {
      return backendRequestOtp(phone);
    }
    // simulate SMS send latency
    await new Promise((r) => setTimeout(r, 1200));
    setOtpSent(true);
    return { ok: true };
  };

  const verifyOtp = async (code: string, name?: string) => {
    if (backendEnabled()) {
      const phone = state.phone || "";
      const res = await backendVerifyOtp(phone, code, name);
      if (!res.ok || !res.userId) return res;
      const needsName = !res.profileName && !name;
      if (needsName) return { ok: true, needsName: true };
      const finalName = name || res.profileName || "کاربر";
      await backendSetName(res.userId, finalName).catch(() => undefined);
      const appUser = await backendLoadUser().catch(() => null);
      if (appUser) {
        const access = await backendAccessMap(appUser.id);
        await backendTouchActivity(appUser.id);
        setState((s) => ({ ...s, user: appUser, accessMap: access }));
        void refreshWallet();
      }
      return { ok: true };
    }

    // ── demo mode ──
    if (code !== "12345") {
      return { ok: false, error: "کد واردشده صحیح نیست. کد آزمایشی: ۱۲۳۴۵" };
    }
    const hadUser = !!user;
    setState((s) => {
      const isAdmin = s.phone === "09121234567";
      const today = new Date().toISOString().slice(0, 10);
      // Use the date from BEFORE this login so a brand-new account also gets
      // the first-login bonus (its stored date is only set after this runs).
      const prevDate = s.user?.lastActiveDate ?? s.lastActiveDate;
      const firstLoginToday = prevDate !== today;
      let streak = s.user?.streakDays ?? 0;
      if (firstLoginToday && s.user) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        streak = prevDate === yesterday ? streak + 1 : 1;
      }
      let u = s.user;
      if (!u) {
        const baseName = name?.trim() || (isAdmin ? "مدیر پلتفرم" : "کاربر مهمان");
        u = {
          id: uid("user"),
          phone: s.phone || "09120000000",
          name: baseName,
          role: (isAdmin ? "admin" : "user") as Role,
          joinedAt: new Date().toISOString(),
          points: s.points || 240,
          xp: s.xp || 120,
          streakDays: s.streak || 3,
          lastActiveDate: today,
        };
      } else if (name?.trim()) {
        // First-login step: apply the name the user just typed.
        u = { ...u, name: name.trim() };
      }
      const finalStreak = s.user ? (firstLoginToday ? streak : u.streakDays) : u.streakDays;
      let next: PersistedState = {
        ...s,
        user: { ...u, streakDays: finalStreak, lastActiveDate: today, xp: s.xp },
      };
      // daily-login bonus (first time each day, including account creation)
      if (firstLoginToday) next = bumpWeekly(withXp(next, 5), "login");
      return next;
    });
    // New user without a name yet → ask for it in the next step.
    return { ok: true, needsName: !hadUser && !name };
  };

  const logout = () => {
    if (backendEnabled()) void backendSignOut();
    setState((s) => ({ ...s, user: null, accessMap: {} }));
  };

  const user = state.user;

  /* ---------- access ---------- */

  const hasAccess = (chapterId: string) => {
    if (!user) return false;
    if (user.role === "admin") return true;
    const ch = state.chapters.find((c) => c.id === chapterId);
    if (ch?.free) return true;
    if (backendEnabled()) return !!state.accessMap[chapterId];
    return (
      state.purchases.some((p) => p.chapterId === chapterId && p.status === "موفق") ||
      state.accessGrants.includes(chapterId)
    );
  };

  const canViewLesson = (lessonId: string) => {
    const ch = state.chapters.find((c) => c.lessons.some((l) => l.id === lessonId));
    if (!ch) return false;
    const lesson = ch.lessons.find((l) => l.id === lessonId);
    if (!lesson) return false;
    if (lesson.free || ch.free) return true;
    return hasAccess(ch.id);
  };

  const buyChapter = (chapterId: string, method: string, couponCode?: string): PurchaseRecord => {
    const ch = state.chapters.find((c) => c.id === chapterId);
    if (!ch) throw new Error("فصل یافت نشد");
    const discount = activeDiscountFor(chapterId);
    const couponPct = couponCode ? (COUPONS[couponCode.toUpperCase()] ?? 0) : 0;
    const pct = Math.min(100, discount.percent + couponPct);
    const finalPrice = Math.max(0, Math.round((ch.price * (100 - pct)) / 100));
    const labelParts: string[] = [];
    if (discount.percent) labelParts.push(`٪${discount.percent} عملکردی`);
    if (couponPct) labelParts.push(`٪${couponPct} کد ${couponCode}`);
    const walletPaid = method === "کیف پول";
    if (walletPaid && state.walletBalance < finalPrice) {
      throw new Error("موجودی کیف پول کافی نیست. لطفاً ابتدا کیف پول را شارژ کنید.");
    }
    const record: PurchaseRecord = {
      id: uid("pur"),
      chapterId,
      chapterTitle: ch.title,
      price: finalPrice,
      basePrice: ch.price,
      discountLabel: labelParts.join(" + "),
      status: "موفق",
      date: new Date().toISOString(),
      receiptId: walletPaid
        ? "WLT-" + Math.random().toString(36).slice(2, 8).toUpperCase()
        : "REC-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    };
    const walletTx: WalletTransaction = {
      id: uid("wtx"),
      type: "purchase",
      amount: finalPrice,
      balanceAfter: Math.max(0, state.walletBalance - finalPrice),
      status: "completed",
      description: `خرید فصل «${ch.title}»`,
      createdAt: new Date().toISOString(),
    };
    setState((s) =>
      withXp(
        {
          ...s,
          purchases: [record, ...s.purchases],
          allPurchases: [record, ...s.allPurchases],
          walletBalance: walletPaid ? s.walletBalance - finalPrice : s.walletBalance,
          walletTransactions: walletPaid
            ? [walletTx, ...s.walletTransactions]
            : s.walletTransactions,
          usedDiscountCodes: couponCode
            ? [...new Set([...s.usedDiscountCodes, couponCode.toUpperCase()])]
            : s.usedDiscountCodes,
          points: s.points + 50,
          notifications: [
            {
              id: uid("n"),
              type: "discount",
              title: "خرید موفق",
              body: `دسترسی شما به فصل «${ch.title}» فعال شد. شروع یادگیری مبارک!`,
              createdAt: new Date().toISOString(),
              read: false,
              link: `/chapters/${chapterId}`,
            },
            ...s.notifications,
          ],
        },
        50
      )
    );
    // Persist the purchase to the database so RLS can enforce access
    // server-side across all devices.
    if (backendEnabled() && user) {
      void (async () => {
        await backendCreatePurchase({
          userId: user.id,
          chapterId,
          price: finalPrice,
          basePrice: ch.price,
          discountLabel: record.discountLabel,
          receiptId: record.receiptId,
        });
        const access = await backendAccessMap(user.id);
        setState((s) => ({ ...s, accessMap: access }));
      })();
    }
    return record;
  };

  const grantAccess = (chapterId: string) => {
    setState((s) => ({
      ...s,
      accessGrants: [...new Set([...s.accessGrants, chapterId])],
      accessMap: { ...s.accessMap, [chapterId]: true },
    }));
    if (backendEnabled() && user) {
      void backendGrantAccess(user.id, chapterId);
    }
  };

  const activeDiscountFor = (chapterId: string): { percent: number; source?: string } => {
    const ch = state.chapters.find((c) => c.id === chapterId);
    if (!ch || ch.index === 1) return { percent: 0 };
    const prev = state.chapters.find((c) => c.index === ch.index - 1);
    if (!prev) return { percent: 0 };
    const attempt = state.examAttempts.find((a) => a.chapterId === prev.id && a.passed);
    if (!attempt) return { percent: 0 };
    const rules = state.discountRules;
    if (attempt.score >= rules.high.min)
      return { percent: rules.high.percent, source: "عملکرد عالی" };
    if (attempt.score >= rules.mid.min) return { percent: rules.mid.percent, source: "عملکرد خوب" };
    if (attempt.score >= rules.low.min)
      return { percent: rules.low.percent, source: "عملکرد قابل قبول" };
    return { percent: 0 };
  };

  const activeDiscount: Discount | null = useMemo(() => {
    if (!user || user.role === "admin") return null;
    const nextChapter = state.chapters.find((c) => {
      const prev = state.chapters[c.index - 2];
      return (
        prev &&
        state.examAttempts.some((a) => a.chapterId === prev.id && a.passed) &&
        !state.purchases.some((p) => p.chapterId === c.id && p.status === "موفق")
      );
    });
    if (!nextChapter) return null;
    const d = activeDiscountFor(nextChapter.id);
    if (!d.percent) return null;
    const expires = new Date(Date.now() + 14 * 86400000).toISOString();
    return {
      percent: d.percent,
      chapterId: nextChapter.id,
      expiresAt: expires,
      source: d.source || "",
    };
  }, [state.examAttempts, state.purchases, state.discountRules, state.chapters, user]);

  /* ---------- progress ---------- */

  const isLessonComplete = (lessonId: string) =>
    !!state.lessonProgress[lessonId.split("-l")[0]]?.[lessonId];

  const toggleLessonComplete = (lessonId: string) => {
    const chId = lessonId.split("-l")[0];
    const done = !!state.lessonProgress[chId]?.[lessonId];
    setState((s) => {
      let next: PersistedState = {
        ...s,
        lessonProgress: {
          ...s.lessonProgress,
          [chId]: { ...s.lessonProgress[chId], [lessonId]: !done },
        },
        points: s.points + (done ? -10 : 10),
      };
      // XP is only earned (never lost) and counts toward the weekly challenge.
      if (!done) next = bumpWeekly(withXp(next, 10), "lesson");
      return next;
    });
    if (backendEnabled() && user) void backendUpsertLessonProgress(user.id, lessonId, !done);
  };

  const submitExercise = (exerciseId: string, answer: string, score: number) => {
    setState((s) =>
      bumpWeekly(
        withXp(
          {
            ...s,
            exerciseSubmissions: {
              ...s.exerciseSubmissions,
              [exerciseId]: {
                status: "انجام‌شده",
                answer,
                score,
                submittedAt: new Date().toISOString(),
              },
            },
            points: s.points + score,
          },
          score
        ),
        "exercise"
      )
    );
    if (backendEnabled() && user) void backendSubmitExercise(user.id, exerciseId, answer, score);
  };

  const getExerciseStatus = (exerciseId: string) => state.exerciseSubmissions[exerciseId];

  /* ---------- exam ---------- */

  const bestExamScore = (chapterId: string) =>
    Math.max(0, ...state.examAttempts.filter((a) => a.chapterId === chapterId).map((a) => a.score));

  const submitExam = (examId: string, answers: (number | null)[]): ExamAttempt => {
    const ch = state.chapters.find((c) => c.exam.id === examId)!;
    const qs = ch.exam.questions;
    const topics = new Map<string, { correct: number; total: number }>();
    qs.forEach((qq, i) => {
      const t = topics.get(qq.topic) || { correct: 0, total: 0 };
      t.total += 1;
      if (answers[i] === qq.correct) t.correct += 1;
      topics.set(qq.topic, t);
    });
    const correct = qs.filter((_, i) => answers[i] === qs[i].correct).length;
    const score = Math.round((correct / qs.length) * 100);
    const passed = score >= ch.exam.passScore;
    const rules = state.discountRules;
    const awardedDiscount =
      passed && ch.index < state.chapters.length
        ? score >= rules.high.min
          ? rules.high.percent
          : score >= rules.mid.min
            ? rules.mid.percent
            : score >= rules.low.min
              ? rules.low.percent
              : 0
        : 0;
    const attempt: ExamAttempt = {
      id: uid("exam"),
      examId,
      chapterId: ch.id,
      chapterTitle: ch.title,
      score,
      correct,
      wrong: qs.length - correct,
      date: new Date().toISOString(),
      passed,
      topicAnalysis: [...topics.entries()].map(([topic, v]) => ({ topic, ...v })),
      awardedDiscount,
    };
    setState((s) =>
      withXp(
        {
          ...s,
          examAttempts: [attempt, ...s.examAttempts],
          points: s.points + score,
          notifications: [
            {
              id: uid("n"),
              type: "exam",
              title: `نتیجه آزمون ${ch.title}`,
              body: `نمره شما: ${score} از ۱۰۰${awardedDiscount ? `. تخفیف ٪${awardedDiscount} برای فصل بعد فعال شد!` : ""}`,
              createdAt: new Date().toISOString(),
              read: false,
              link: `/chapters/${ch.id}/exam/result/${attempt.id}`,
            },
            ...s.notifications,
          ],
        },
        score
      )
    );
    if (backendEnabled() && user)
      void (async () => {
        // Answer indices only — the server grades and sends the result +
        // performance-discount notification (in-app + SMS) via NotificationService.
        const server = await backendSubmitExam(
          user.id,
          {
            examId: attempt.examId,
            chapterId: ch.id,
            score: attempt.score,
            correct: attempt.correct,
            wrong: attempt.wrong,
            passed: attempt.passed,
            topicAnalysis: attempt.topicAnalysis,
            awardedDiscount: attempt.awardedDiscount ?? 0,
          },
          answers
        );
        // The server grade is authoritative — sync the stored attempt when it differs.
        if (
          server &&
          (server.score !== attempt.score ||
            server.awardedDiscount !== (attempt.awardedDiscount ?? 0))
        ) {
          setState((s) => ({
            ...s,
            examAttempts: s.examAttempts.map((a) =>
              a.id === attempt.id
                ? {
                    ...a,
                    score: server.score,
                    correct: server.correct,
                    wrong: server.wrong,
                    passed: server.passed,
                    awardedDiscount: server.awardedDiscount,
                  }
                : a
            ),
          }));
        }
      })();
    return attempt;
  };

  /* ---------- quiz ---------- */

  const isDailyQuizDone = (date: string) => state.dailyQuizDates.includes(date);

  const submitQuiz = (
    quizId: string,
    score: number,
    total: number,
    answers: number[] = [],
    durationSeconds = 0
  ) => {
    const quiz = state.quizzes.find((q) => q.id === quizId)?.title || "کوییز";
    setState((s) => {
      const today = new Date().toISOString().slice(0, 10);
      const isDaily = quizId === "quiz-daily";
      const alreadyDone = isDaily && s.dailyQuizDates.includes(today);
      // Replaying the daily quiz on the same day must not grant points again.
      const pointsGain = alreadyDone ? 0 : score;
      const attempt = {
        id: uid("qa"),
        quizId,
        title: quiz,
        score,
        total,
        date: new Date().toISOString(),
      };
      let next: PersistedState = {
        ...s,
        quizAttempts: alreadyDone ? s.quizAttempts : [attempt, ...s.quizAttempts],
        dailyQuizDates: alreadyDone ? s.dailyQuizDates : [...s.dailyQuizDates, today],
        points: s.points + pointsGain,
      };
      if (!alreadyDone) next = bumpWeekly(withXp(next, pointsGain), "quiz");
      return next;
    });
    if (backendEnabled() && user)
      void backendSubmitQuiz(user.id, quizId, score, total, answers, durationSeconds);
  };

  /* ---------- live matches ---------- */

  const submitMatch = (r: Omit<LiveMatchResult, "id" | "date">) => {
    const record: LiveMatchResult = { ...r, id: uid("match"), date: new Date().toISOString() };
    const xpGain = r.rank === 1 ? 60 : r.rank === 2 ? 40 : r.rank === 3 ? 25 : 10;
    setState((s) =>
      bumpWeekly(
        withXp(
          {
            ...s,
            matchHistory: [record, ...s.matchHistory],
            notifications:
              r.rank === 1
                ? [
                    {
                      id: uid("n"),
                      type: "quiz",
                      title: "برد در مسابقه زنده 🏆",
                      body: `در مسابقه ${r.mode === "1v1" ? "تک‌به‌تک" : "۴ نفره"} مقام اول را کسب کردید و ${xpGain} XP گرفتید.`,
                      createdAt: new Date().toISOString(),
                      read: false,
                      link: "/quiz/live",
                    },
                    ...s.notifications,
                  ]
                : s.notifications,
          },
          xpGain
        ),
        "match"
      )
    );
  };

  const claimWeeklyReward = (challengeId: string) => {
    const def = WEEKLY_CHALLENGES.find((c) => c.id === challengeId);
    if (!def) return;
    const key = weekKey();
    setState((s) => {
      const tasks = s.weekly.weekKey === key ? s.weekly.tasks : {};
      const claimed = s.weeklyClaimed[key] ?? [];
      const progress = tasks[def.type] ?? 0;
      if (progress < def.target || claimed.includes(challengeId)) return s;
      return withXp(
        { ...s, weeklyClaimed: { ...s.weeklyClaimed, [key]: [...claimed, challengeId] } },
        def.rewardXp
      );
    });
  };

  /* ---------- notifications ---------- */

  const markAllRead = () => {
    if (backendEnabled()) void backendMarkAllNotificationsRead();
    setState((s) => ({ ...s, notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
  };

  const markOneRead = (id: string) => {
    if (backendEnabled()) void backendMarkNotificationRead(id);
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  };

  const unreadCount = state.notifications.filter((n) => !n.read).length;

  /* ---------- community ---------- */

  const toggleLike = (postId: string) => {
    const liked = (state.postLikes[postId] || 0) > 0;
    setState((s) => ({
      ...s,
      postLikes: { ...s.postLikes, [postId]: liked ? -1 : 1 },
    }));
    if (backendEnabled() && user) void backendTogglePostLike(user.id, postId, !liked);
  };

  const toggleSave = (postId: string) => {
    const saved = state.savedPosts.includes(postId);
    setState((s) => ({
      ...s,
      savedPosts: saved ? s.savedPosts.filter((p) => p !== postId) : [...s.savedPosts, postId],
    }));
    if (backendEnabled() && user) void backendToggleSavedPost(user.id, postId, !saved);
  };

  const addPost = (title: string, body: string, category: string, tags: string[]) => {
    if (!user) return;
    const post: CommunityPost = {
      id: uid("post"),
      author: { name: user.name, role: "کاربر" },
      category,
      title,
      body,
      tags,
      createdAt: new Date().toISOString(),
      likes: 0,
      commentsCount: 0,
      status: "open",
    };
    setState((s) =>
      bumpWeekly(withXp({ ...s, communityPosts: [post, ...s.communityPosts] }, 10), "community")
    );
    if (backendEnabled()) void backendCreatePost(user.id, { category, title, body, tags });
  };

  const addComment = (postId: string, body: string) => {
    if (!user) return;
    const comment: CommunityComment = {
      id: uid("c"),
      postId,
      author: { name: user.name, role: "کاربر" },
      body,
      createdAt: new Date().toISOString(),
      likes: 0,
    };
    setState((s) => {
      const next: PersistedState = {
        ...s,
        communityComments: [comment, ...s.communityComments],
        communityPosts: s.communityPosts.map((p) =>
          p.id === postId ? { ...p, commentsCount: p.commentsCount + 1 } : p
        ),
        // Only notify the author when the post actually belongs to them.
        notifications: s.communityPosts.some((p) => p.id === postId)
          ? [
              {
                id: uid("n"),
                type: "community",
                title: "پاسخ جدید",
                body: `${user.name} به پست شما پاسخ داد.`,
                createdAt: new Date().toISOString(),
                read: false,
                link: `/community/${postId}`,
              },
              ...s.notifications,
            ]
          : s.notifications,
      };
      return bumpWeekly(withXp(next, 5), "community");
    });
    if (backendEnabled()) void backendCreateComment(user.id, postId, body);
  };

  const reportPost = (postId: string) =>
    setState((s) => ({
      ...s,
      reportCounts: { ...s.reportCounts, [postId]: (s.reportCounts[postId] || 0) + 1 },
    }));

  /* ---------- notes & questions ---------- */

  const addNote = (lessonId: string, lessonTitle: string, text: string) => {
    setState((s) => ({
      ...s,
      notes: [
        { id: uid("note"), lessonId, lessonTitle, text, createdAt: new Date().toISOString() },
        ...s.notes,
      ],
    }));
    if (backendEnabled() && user) void backendCreateNote(user.id, lessonId, text);
  };

  const deleteNote = (noteId: string) => {
    setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== noteId) }));
    if (backendEnabled() && user) void backendDeleteNote(user.id, noteId);
  };

  const askQuestion = (lessonId: string, text: string) => {
    setState((s) => ({
      ...s,
      lessonQuestions: [
        { id: uid("q"), lessonId, text, createdAt: new Date().toISOString() },
        ...s.lessonQuestions,
      ],
      notifications: [
        {
          id: uid("n"),
          type: "support",
          title: "سؤال شما ثبت شد",
          body: "سؤال شما به مدرس ارسال شد. پاسخ آن در همین صفحه نمایش داده می‌شود.",
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...s.notifications,
      ],
    }));
    if (backendEnabled() && user) void backendAskQuestion(user.id, lessonId, text);
  };

  /* ---------- admin ---------- */

  const setDiscountRules = (rules: DiscountRules) =>
    setState((s) => ({ ...s, discountRules: rules }));

  const updateNotifications = (items: NotificationItem[]) =>
    setState((s) => ({ ...s, notifications: items }));

  const addNotification = (n: Omit<NotificationItem, "id" | "read" | "createdAt">) =>
    setState((s) => ({
      ...s,
      notifications: [
        { ...n, id: uid("n"), read: false, createdAt: new Date().toISOString() },
        ...s.notifications,
      ],
    }));

  const deleteUser = (userId: string) =>
    setState((s) => ({ ...s, user: s.user?.id === userId ? null : s.user }));

  /* ---------- dynamic content CRUD ---------- */

  const deleteNotification = (id: string) => {
    if (backendEnabled()) void backendDeleteNotification(id);
    setState((s) => ({ ...s, notifications: s.notifications.filter((n) => n.id !== id) }));
  };

  const saveChapter = (ch: Chapter) => {
    setState((s) => {
      const exists = s.chapters.some((c) => c.id === ch.id);
      const chapters = exists
        ? s.chapters.map((c) => (c.id === ch.id ? ch : c))
        : [...s.chapters, ch].sort((a, b) => a.index - b.index);
      return { ...s, chapters };
    });
    if (backendEnabled()) void backendSaveChapter(ch);
  };

  const deleteChapter = (id: string) => {
    setState((s) => ({
      ...s,
      chapters: s.chapters.filter((c) => c.id !== id),
      purchases: s.purchases.filter((p) => p.chapterId !== id),
      allPurchases: s.allPurchases.filter((p) => p.chapterId !== id),
      accessGrants: s.accessGrants.filter((c) => c !== id),
      accessMap: Object.fromEntries(Object.entries(s.accessMap).filter(([k]) => k !== id)),
    }));
    if (backendEnabled()) void backendDeleteChapter(id);
  };

  const saveQuiz = (q: Quiz) => {
    setState((s) => {
      const exists = s.quizzes.some((x) => x.id === q.id);
      return {
        ...s,
        quizzes: exists ? s.quizzes.map((x) => (x.id === q.id ? q : x)) : [...s.quizzes, q],
      };
    });
    if (backendEnabled()) void backendSaveQuiz(q);
  };

  const deleteQuiz = (id: string) => {
    setState((s) => ({ ...s, quizzes: s.quizzes.filter((q) => q.id !== id) }));
    if (backendEnabled()) void backendDeleteQuiz(id);
  };

  /** Auto-build a quiz from the question bank (admin “تولید خودکار”). */
  const generateQuiz = (opts: {
    kind: "daily" | "weekly" | "category";
    category: string;
    difficulty: "آسان" | "متوسط" | "سخت";
    title: string;
    count: number;
    durationSeconds?: number;
    replaceId?: string;
  }): Quiz => {
    const bank = state.questionBank;
    const byCat = bank.filter((q) => q.category === opts.category);
    const pool =
      byCat.length >= opts.count
        ? byCat
        : bank.filter((q) => q.difficulty === opts.difficulty).length >= opts.count
          ? bank.filter((q) => q.difficulty === opts.difficulty)
          : bank;
    // deterministic-ish shuffle then pick without repetition
    const picked: QuestionBankEntry[] = [];
    const used = new Set<string>();
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    for (const q of shuffled) {
      if (picked.length >= opts.count) break;
      if (used.has(q.id)) continue;
      used.add(q.id);
      picked.push(q);
    }
    const quiz: Quiz = {
      id: opts.replaceId || uid("quiz"),
      kind: opts.kind,
      title: opts.title,
      category: opts.category,
      difficulty: opts.difficulty,
      durationSeconds: opts.durationSeconds ?? Math.max(30, picked.length * 15),
      pointsPerQuestion: 10,
      questions: picked.map((q) => ({
        id: q.id,
        text: q.text,
        options: [...q.options],
        correct: q.correct,
        explanation: q.explanation,
      })),
    };
    setState((s) => {
      const exists = s.quizzes.some((x) => x.id === quiz.id);
      return {
        ...s,
        quizzes: exists
          ? s.quizzes.map((x) => (x.id === quiz.id ? quiz : x))
          : [...s.quizzes, quiz],
      };
    });
    return quiz;
  };

  const saveTool = (t: AiTool) => {
    setState((s) => {
      const exists = s.aiTools.some((x) => x.id === t.id);
      return {
        ...s,
        aiTools: exists ? s.aiTools.map((x) => (x.id === t.id ? t : x)) : [t, ...s.aiTools],
      };
    });
    if (backendEnabled()) void backendSaveAiTool(t);
  };

  const deleteTool = (id: string) => {
    setState((s) => ({ ...s, aiTools: s.aiTools.filter((t) => t.id !== id) }));
    if (backendEnabled()) void backendDeleteAiTool(id);
  };

  const deletePost = (id: string) =>
    setState((s) => ({
      ...s,
      communityPosts: s.communityPosts.filter((p) => p.id !== id),
      communityComments: s.communityComments.filter((c) => c.postId !== id),
    }));

  const setPostStatus = (id: string, status: "open" | "closed") =>
    setState((s) => ({
      ...s,
      communityPosts: s.communityPosts.map((p) => (p.id === id ? { ...p, status } : p)),
    }));

  const deleteComment = (id: string) =>
    setState((s) => ({
      ...s,
      communityComments: s.communityComments.filter((c) => c.id !== id),
    }));

  const clearReport = (id: string) =>
    setState((s) => {
      const next = { ...s.reportCounts };
      delete next[id];
      return { ...s, reportCounts: next };
    });

  const saveManagedUser = (u: ManagedUser) => {
    setState((s) => {
      const exists = s.managedUsers.some((x) => x.id === u.id);
      return {
        ...s,
        managedUsers: exists
          ? s.managedUsers.map((x) => (x.id === u.id ? u : x))
          : [...s.managedUsers, u],
      };
    });
    if (backendEnabled() && user) void backendAdminSaveUser(u);
  };

  const deleteManagedUser = (id: string) => {
    setState((s) => ({
      ...s,
      // Never let an admin delete their own currently-logged-in account.
      managedUsers: s.managedUsers.filter((u) => !(u.id === id && s.user?.id === id)),
    }));
    if (backendEnabled() && user && user.id !== id) void backendAdminDeleteUser(id);
  };

  const updateSite = (patch: Partial<SiteSettings>) =>
    setState((s) => ({ ...s, site: { ...s.site, ...patch } }));

  const setCoupons = (c: Record<string, number>) => setState((s) => ({ ...s, coupons: c }));

  const saveQuestion = (q: QuestionBankEntry) =>
    setState((s) => {
      const exists = s.questionBank.some((x) => x.id === q.id);
      return {
        ...s,
        questionBank: exists
          ? s.questionBank.map((x) => (x.id === q.id ? q : x))
          : [...s.questionBank, q],
      };
    });

  const deleteQuestion = (id: string) =>
    setState((s) => ({ ...s, questionBank: s.questionBank.filter((q) => q.id !== id) }));

  const updatePurchase = (id: string, status: PurchaseRecord["status"]) =>
    setState((s) => ({
      ...s,
      allPurchases: s.allPurchases.map((p) => (p.id === id ? { ...p, status } : p)),
      purchases: s.purchases.map((p) => (p.id === id ? { ...p, status } : p)),
    }));

  const syncPurchase = (p: PurchaseRecord) =>
    setState((s) => {
      const exists = s.purchases.some((x) => x.id === p.id);
      return {
        ...s,
        purchases: exists ? s.purchases.map((x) => (x.id === p.id ? p : x)) : [p, ...s.purchases],
        allPurchases: exists
          ? s.allPurchases.map((x) => (x.id === p.id ? p : x))
          : [p, ...s.allPurchases],
        accessMap: { ...s.accessMap, [p.chapterId]: p.status === "موفق" },
      };
    });

  const refreshPurchaseStatus = async (purchaseId: string) => {
    if (!backendEnabled() || !user) return;
    const status = await backendFetchPurchaseStatus(purchaseId).catch(() => null);
    if (!status) return;
    const ch = state.chapters.find((c) => c.id === status.chapterId);
    syncPurchase({
      id: status.id,
      chapterId: status.chapterId,
      chapterTitle: ch?.title || "فصل",
      price: status.price,
      basePrice: status.basePrice,
      discountLabel: status.discountLabel || "",
      status: (status.status === "paid"
        ? "موفق"
        : status.status === "failed"
          ? "ناموفق"
          : status.status === "cancelled" || status.status === "refunded"
            ? "لغوشده"
            : "در انتظار") as PurchaseRecord["status"],
      date: status.createdAt,
      receiptId: status.receiptId || status.id,
      refundStatus: status.refundStatus ?? "none",
      refundReason: status.refundReason ?? undefined,
      refundRequestedAt: status.refundRequestedAt ?? undefined,
    });
  };

  const setPurchaseRefund = (id: string, patch: Partial<PurchaseRecord>) =>
    setState((s) => ({
      ...s,
      allPurchases: s.allPurchases.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      purchases: s.purchases.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));

  const requestRefund = async (purchaseId: string, reason?: string) => {
    if (backendEnabled()) {
      const res = await backendRequestRefund(purchaseId, reason);
      if (!res.ok) return res;
    }
    // Demo / optimistic update — the row keeps access until an admin approves.
    setPurchaseRefund(purchaseId, {
      refundStatus: "pending",
      refundReason: reason,
      refundRequestedAt: new Date().toISOString(),
    });
    return { ok: true };
  };

  /* ---------- wallet ---------- */

  const refreshWallet = async () => {
    if (!backendEnabled()) return;
    const info = await backendWalletInfo().catch(() => null);
    if (!info) return;
    setState((s) => ({
      ...s,
      walletBalance: info.balance,
      walletTransactions: info.transactions.length ? info.transactions : s.walletTransactions,
    }));
  };

  const chargeWallet = async (amount: number) => {
    if (backendEnabled()) {
      const res = await backendChargeWallet(amount);
      if (res.error || !res.checkoutUrl)
        return { ok: false, error: res.error || "خطا در ایجاد تراکنش شارژ" };
      return { ok: true, checkoutUrl: res.checkoutUrl };
    }
    // Demo mode: simulate a successful charge and credit the balance.
    await new Promise((r) => setTimeout(r, 900));
    setState((s) => {
      const tx: WalletTransaction = {
        id: uid("wtx"),
        type: "charge",
        amount,
        balanceAfter: s.walletBalance + amount,
        status: "completed",
        description: "شارژ کیف پول (شبیه‌ساز)",
        createdAt: new Date().toISOString(),
      };
      return {
        ...s,
        walletBalance: s.walletBalance + amount,
        walletTransactions: [tx, ...s.walletTransactions],
      };
    });
    return { ok: true, checkoutUrl: null };
  };

  /* ---------- prompt lab ---------- */

  const savePromptTool = (t: PromptTool) => {
    setState((s) => {
      const exists = s.promptTools.some((x) => x.id === t.id);
      return {
        ...s,
        promptTools: exists
          ? s.promptTools.map((x) => (x.id === t.id ? t : x))
          : [...s.promptTools, t],
      };
    });
    if (backendEnabled()) void backendSavePromptTool(t);
  };

  const deletePromptTool = (id: string) => {
    setState((s) => ({
      ...s,
      promptTools: s.promptTools.filter((t) => t.id !== id),
      // حذف ابزار از سناریوها
      promptScenarios: s.promptScenarios.map((sc) => ({
        ...sc,
        toolIds: sc.toolIds.filter((tid) => tid !== id),
      })),
    }));
    if (backendEnabled()) void backendDeletePromptTool(id);
  };

  const savePromptScenario = (sc: PromptScenario) => {
    setState((s) => {
      const exists = s.promptScenarios.some((x) => x.id === sc.id);
      return {
        ...s,
        promptScenarios: exists
          ? s.promptScenarios.map((x) => (x.id === sc.id ? sc : x))
          : [...s.promptScenarios, sc],
      };
    });
    if (backendEnabled()) void backendSavePromptScenario(sc);
  };

  const deletePromptScenario = (id: string) => {
    setState((s) => ({
      ...s,
      promptScenarios: s.promptScenarios.filter((sc) => sc.id !== id),
      promptAttempts: s.promptAttempts.filter((a) => a.scenarioId !== id),
    }));
    if (backendEnabled()) void backendDeletePromptScenario(id);
  };

  const saveShortVideo = (v: ShortVideo) => {
    setState((s) => {
      const exists = s.shortVideos.some((x) => x.id === v.id);
      return {
        ...s,
        shortVideos: exists
          ? s.shortVideos.map((x) => (x.id === v.id ? v : x))
          : [v, ...s.shortVideos],
      };
    });
    if (backendEnabled()) void backendSaveShortVideo(v);
  };

  const deleteShortVideo = (id: string) => {
    setState((s) => ({ ...s, shortVideos: s.shortVideos.filter((v) => v.id !== id) }));
    if (backendEnabled()) void backendDeleteShortVideo(id);
  };

  const incrementShortVideoEngagement = (id: string, kind: "view" | "like") => {
    setState((s) => ({
      ...s,
      shortVideos: s.shortVideos.map((v) =>
        v.id === id
          ? {
              ...v,
              [kind === "view" ? "views" : "likes"]: v[kind === "view" ? "views" : "likes"] + 1,
            }
          : v
      ),
    }));
    if (backendEnabled()) {
      if (kind === "view") void backendIncrementDiscovery(id, "view");
      else void backendIncrementLike(id, "video");
    }
  };

  const saveTrendingPrompt = (p: TrendingPrompt) => {
    setState((s) => {
      const exists = s.trendingPrompts.some((x) => x.id === p.id);
      return {
        ...s,
        trendingPrompts: exists
          ? s.trendingPrompts.map((x) => (x.id === p.id ? p : x))
          : [p, ...s.trendingPrompts],
      };
    });
    if (backendEnabled()) void backendSaveTrendingPrompt(p);
  };

  const deleteTrendingPrompt = (id: string) => {
    setState((s) => ({ ...s, trendingPrompts: s.trendingPrompts.filter((p) => p.id !== id) }));
    if (backendEnabled()) void backendDeleteTrendingPrompt(id);
  };

  const incrementPromptEngagement = (id: string, kind: "use" | "like") => {
    setState((s) => ({
      ...s,
      trendingPrompts: s.trendingPrompts.map((p) =>
        p.id === id
          ? { ...p, [kind === "use" ? "uses" : "likes"]: p[kind === "use" ? "uses" : "likes"] + 1 }
          : p
      ),
    }));
    if (backendEnabled()) {
      if (kind === "use") void backendIncrementDiscovery(id, "use");
      else void backendIncrementLike(id, "prompt");
    }
  };

  const submitPromptLab = (a: Omit<PromptAttempt, "id" | "createdAt">): PromptAttempt => {
    const full: PromptAttempt = { ...a, id: uid("pa"), createdAt: new Date().toISOString() };
    const xpGain = Math.max(2, Math.round((full.score / full.maxScore) * 10));
    setState((s) =>
      bumpWeekly(
        withXp(
          {
            ...s,
            promptAttempts: [full, ...s.promptAttempts].slice(0, 60),
            points: s.points + xpGain,
          },
          xpGain
        ),
        "prompt"
      )
    );
    if (backendEnabled() && user) void backendSubmitPromptAttempt(user.id, full);
    return full;
  };

  /* ---------- computed ---------- */

  const chapterProgress = (chapterId: string) => {
    const ch = state.chapters.find((c) => c.id === chapterId);
    if (!ch) return 0;
    const done = ch.lessons.filter((l) => isLessonComplete(l.id)).length;
    return Math.round((done / ch.lessons.length) * 100);
  };

  const overallProgress = useMemo(() => {
    const all = state.chapters.flatMap((c) => c.lessons);
    if (!all.length) return 0;
    const done = all.filter((l) => isLessonComplete(l.id)).length;
    return Math.round((done / all.length) * 100);
  }, [state.lessonProgress, state.chapters]);

  const earnedBadges = useMemo(() => {
    const badges: string[] = [];
    const totalLessons = state.chapters.flatMap((c) => c.lessons).length;
    const doneLessons = Object.values(state.lessonProgress).reduce(
      (acc, m) => acc + Object.values(m).filter(Boolean).length,
      0
    );
    if (doneLessons >= 1) badges.push("b1");
    if (doneLessons >= 5) badges.push("b2");
    if (state.examAttempts.some((a) => a.chapterId === "ch2" && a.passed)) badges.push("b3");
    if (state.examAttempts.some((a) => a.chapterId === "ch3" && a.passed)) badges.push("b4");
    if (state.examAttempts.some((a) => a.chapterId === "ch4" && a.passed)) badges.push("b5");
    if (state.examAttempts.some((a) => a.chapterId === "ch5" && a.passed)) badges.push("b6");
    if (state.examAttempts.some((a) => a.chapterId === "ch6" && a.passed)) badges.push("b7");
    if (state.streak >= 7) badges.push("b8");
    const correctAnswers = state.quizAttempts.reduce((acc, a) => acc + a.score, 0);
    if (correctAnswers >= 20) badges.push("b9");
    const comments = state.communityComments.length;
    if (comments >= 10) badges.push("b10");
    if (doneLessons >= totalLessons) badges.push("b7");
    return badges;
  }, [state]);

  const xp = user?.xp ?? state.xp;

  const level = useMemo(() => levelFromXp(xp), [xp]);

  const weeklyChallenge = useMemo(() => {
    const key = weekKey();
    const tasks = state.weekly.weekKey === key ? state.weekly.tasks : {};
    const claimed = state.weeklyClaimed[key] ?? [];
    const challenges = WEEKLY_CHALLENGES.map((c) => ({
      def: c,
      progress: Math.min(c.target, tasks[c.type] ?? 0),
      claimed: claimed.includes(c.id),
      ready: (tasks[c.type] ?? 0) >= c.target && !claimed.includes(c.id),
    }));
    return {
      weekKey: key,
      tasks,
      challenges,
      done: challenges.filter((c) => c.claimed || c.ready).length,
      total: WEEKLY_CHALLENGES.length,
    };
  }, [state.weekly, state.weeklyClaimed]);

  const matchStats = useMemo(() => {
    const wins = state.matchHistory.filter((m) => m.won).length;
    return {
      wins,
      total: state.matchHistory.length,
      best: state.matchHistory.length ? Math.min(...state.matchHistory.map((m) => m.rank)) : null,
    };
  }, [state.matchHistory]);

  const isDemoUser = !!user;

  const value: AppContextValue = {
    state,
    user,
    otpSent,
    requestOtp,
    verifyOtp,
    logout,
    hasAccess,
    canViewLesson,
    buyChapter,
    grantAccess,
    isLessonComplete,
    toggleLessonComplete,
    submitExercise,
    getExerciseStatus,
    submitExam,
    submitQuiz,
    isDailyQuizDone,
    xp,
    level,
    weeklyChallenge,
    claimWeeklyReward,
    submitMatch,
    matchStats,
    markAllRead,
    markOneRead,
    unreadCount,
    toggleLike,
    toggleSave,
    addPost,
    addComment,
    reportPost,
    addNote,
    deleteNote,
    askQuestion,
    setDiscountRules,
    updateNotifications,
    addNotification,
    deleteNotification,
    deleteUser,
    chapters: state.chapters,
    quizzes: state.quizzes,
    aiTools: state.aiTools,
    communityPosts: state.communityPosts,
    communityComments: state.communityComments,
    managedUsers: state.managedUsers,
    site: state.site,
    coupons: state.coupons,
    questionBank: state.questionBank,
    allPurchases: state.allPurchases,
    saveChapter,
    deleteChapter,
    saveQuiz,
    deleteQuiz,
    generateQuiz,
    saveTool,
    deleteTool,
    deletePost,
    setPostStatus,
    deleteComment,
    clearReport,
    saveManagedUser,
    deleteManagedUser,
    updateSite,
    setCoupons,
    saveQuestion,
    deleteQuestion,
    updatePurchase,
    syncPurchase,
    refreshPurchaseStatus,
    setPurchaseRefund,
    requestRefund,
    walletBalance: state.walletBalance,
    walletTransactions: state.walletTransactions,
    chargeWallet,
    refreshWallet,
    promptTools: state.promptTools,
    promptScenarios: state.promptScenarios,
    promptAttempts: state.promptAttempts,
    shortVideos: state.shortVideos,
    trendingPrompts: state.trendingPrompts,
    savePromptTool,
    deletePromptTool,
    savePromptScenario,
    deletePromptScenario,
    saveShortVideo,
    deleteShortVideo,
    incrementShortVideoEngagement,
    saveTrendingPrompt,
    deleteTrendingPrompt,
    incrementPromptEngagement,
    submitPromptLab,
    activeDiscount,
    bestExamScore,
    chapterProgress,
    overallProgress,
    earnedBadges,
    isDemoUser,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
