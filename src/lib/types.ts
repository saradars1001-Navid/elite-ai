export type Level = "مقدماتی" | "متوسط" | "پیشرفته";
export type Role = "user" | "admin";

export interface Instructor {
  name: string;
  role: string;
}

export interface Lesson {
  id: string;
  chapterId: string;
  index: number;
  title: string;
  kind: "video" | "text";
  duration: number;
  summary: string;
  content: string[];
  captions?: string[];
  free: boolean;
}

export type ExerciseType =
  "mcq" | "truefalse" | "short" | "ordering" | "prompt-choice" | "practical";

export interface Exercise {
  id: string;
  chapterId: string;
  index: number;
  title: string;
  type: ExerciseType;
  problem: string;
  goal: string;
  tool?: string;
  guide: string[];
  points: number;
  options?: string[];
  correctIndex?: number;
  correctBool?: boolean;
  correctOrder?: string[];
  sampleAnswer: string;
}

export interface ExamQuestion {
  id: string;
  text: string;
  options: string[];
  correct: number;
  topic: string;
}

export interface Exam {
  id: string;
  chapterId: string;
  title: string;
  durationMinutes: number;
  passScore: number;
  questions: ExamQuestion[];
}

export interface Project {
  title: string;
  description: string;
  tasks: string[];
  tools: string[];
  deliverable: string;
}

export interface Chapter {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  description: string;
  level: Level;
  instructor: Instructor;
  duration: number;
  price: number;
  oldPrice?: number;
  free: boolean;
  icon: string;
  gradient: string;
  prerequisites: string[];
  outcome: string[];
  completionRate: number;
  rating: number;
  students: number;
  previewCount: number;
  lessons: Lesson[];
  exercises: Exercise[];
  exam: Exam;
  project: Project;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface Quiz {
  id: string;
  kind: "daily" | "weekly" | "category";
  title: string;
  category: string;
  difficulty: "آسان" | "متوسط" | "سخت";
  durationSeconds: number;
  pointsPerQuestion: number;
  questions: QuizQuestion[];
}

export interface CommunityAuthor {
  name: string;
  role: string;
  expert?: boolean;
}

export interface CommunityPost {
  id: string;
  author: CommunityAuthor;
  category: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: string;
  likes: number;
  commentsCount: number;
  status: "open" | "closed";
}

export interface CommunityComment {
  id: string;
  postId: string;
  author: CommunityAuthor;
  body: string;
  createdAt: string;
  likes: number;
}

export interface AiTool {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  useCases: string[];
  level: "آسان" | "متوسط" | "حرفهای";
  pricing: "رایگان" | "پولی" | "رایگان + پولی";
  languages: string[];
  url: string;
  rating: number;
  reviews: number;
  relatedLessons: string[];
  reviewedAt: string;
  isNew?: boolean;
  output: string;
}

export interface NotificationItem {
  id: string;
  type:
    | "chapter"
    | "lesson"
    | "quiz"
    | "discount"
    | "exam"
    | "badge"
    | "community"
    | "support"
    | "payment";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  condition: string;
}

export interface PurchaseRecord {
  id: string;
  chapterId: string;
  chapterTitle: string;
  price: number;
  basePrice: number;
  discountLabel: string;
  status: "موفق" | "ناموفق" | "لغوشده" | "در انتظار";
  date: string;
  receiptId: string;
  /** وضعیت درخواست بازگشت وجه (مستقل از وضعیت پرداخت). */
  refundStatus?: "none" | "pending" | "refunded" | "rejected";
  refundReason?: string;
  refundRequestedAt?: string;
}

/** ردیف درخواست بازگشت وجه برای پنل ادمین. */
export interface RefundRequest {
  id: string;
  chapterId: string;
  chapterTitle: string;
  userName: string;
  userPhone: string;
  price: number;
  receiptId: string;
  status: "paid" | "refunded" | "pending" | "failed";
  refundStatus: "none" | "pending" | "refunded" | "rejected";
  refundReason: string;
  refundRequestedAt?: string;
  refundedAt?: string;
  refundRejectedAt?: string;
  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  type: "charge" | "purchase" | "refund" | "bonus";
  amount: number;
  balanceAfter: number;
  status: "pending" | "completed" | "failed";
  description: string;
  createdAt: string;
}

export interface Discount {
  percent: number;
  chapterId: string;
  expiresAt: string;
  source: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  chapterId: string;
  chapterTitle: string;
  score: number;
  correct: number;
  wrong: number;
  date: string;
  passed: boolean;
  topicAnalysis: { topic: string; correct: number; total: number }[];
  awardedDiscount?: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  title: string;
  score: number;
  total: number;
  date: string;
}

export interface Note {
  id: string;
  lessonId: string;
  lessonTitle: string;
  text: string;
  createdAt: string;
}

export interface LessonQuestion {
  id: string;
  lessonId: string;
  text: string;
  createdAt: string;
}

export interface AppUser {
  id: string;
  phone: string;
  name: string;
  role: Role;
  joinedAt: string;
  points: number;
  xp: number;
  streakDays: number;
  lastActiveDate: string;
}

/** User row managed from the admin panel. */
export interface ManagedUser {
  id: string;
  name: string;
  phone: string;
  role: Role;
  label: string; // نقش نمایشی (کارآفرین، مدرس و…)
  color: string;
  joinedAt: string;
  status: "فعال" | "غیرفعال";
  purchases: number;
}

export interface SiteSettings {
  name: string;
  slogan: string;
  supportPhone: string;
  supportEmail: string;
  toggles: {
    gateway: boolean;
    wallet: boolean;
    sms: boolean;
    comments: boolean;
    guestQuiz: boolean;
  };
}

/** Question-bank entry used by the admin's automatic quiz generator. */
export interface QuestionBankEntry {
  id: string;
  text: string;
  options: string[];
  correct: number;
  explanation: string;
  category: string;
  difficulty: "آسان" | "متوسط" | "سخت";
}

export interface LiveMatchResult {
  id: string;
  mode: "1v1" | "ffa";
  rank: number;
  players: number;
  score: number;
  correct: number;
  total: number;
  date: string;
  won: boolean;
}

/* ─────────────────────── Prompt Lab (پرامپت‌لب) ─────────────────────── */

/** ابزار نمونه‌ای که پرامپت کاربر با آن «اجرا» می‌شود (شبیه‌سازی آموزشی). */
export interface PromptTool {
  id: string;
  name: string;
  emoji: string;
  category: string;
  description: string;
  style: string; // سبک پاسخ نمونه (مثلاً «تحلیلی و ساختارمند»)
}

/** سناریوی تمرینی پرامپت‌نویسی. */
export interface PromptScenario {
  id: string;
  title: string;
  description: string;
  category: string; // مثلاً «نگارش» | «تصویر» | «کدنویسی» | «تحلیل»
  taskType: "متن" | "تصویر" | "کد" | "جدول" | "تحلیل";
  toolIds: string[]; // ابزارهای پیشنهادی برای این سناریو
  samplePrompt: string; // پرامپت نمونه (پاسخ ایده‌آل)
  goal: string; // هدف تمرین
  timeSeconds: number;
  points: number; // حداکثر امتیاز
}

/** معیار امتیازدهی هر پرامپت. */
export interface PromptCriterion {
  key: string;
  label: string;
  hint: string;
  points: number;
  max: number;
  ok: boolean;
}

/** خروجی شبیه‌سازی‌شده یک ابزار برای یک پرامپت. */
export interface PromptToolResult {
  toolId: string;
  output: string;
}

/** یک تلاش ثبت‌شده در پرامپت‌لب. */
export interface PromptAttempt {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  prompt: string;
  score: number;
  maxScore: number;
  criteria: PromptCriterion[];
  toolResults: PromptToolResult[];
  createdAt: string;
}

/** محتوای کوتاه عمودی برای اکسپلور اپلیکیشنی. */
export interface ShortVideo {
  id: string;
  title: string;
  creator: string;
  creatorRole: string;
  category: string;
  description: string;
  videoUrl: string;
  posterUrl?: string;
  durationSeconds: number;
  tags: string[];
  views: number;
  likes: number;
  createdAt: string;
  status: "published" | "draft" | "archived";
  featured: boolean;
}

/** پرامپت قابل ذخیره/ترند شدن در بانک ایده‌ها. */
export interface TrendingPrompt {
  id: string;
  title: string;
  prompt: string;
  category: "تصویر" | "ویدئو" | "موسیقی" | "پاورپوینت" | "متن" | "کدنویسی" | "تحلیل";
  tool: string;
  author: string;
  description: string;
  tags: string[];
  uses: number;
  likes: number;
  createdAt: string;
  status: "published" | "draft" | "archived";
  featured: boolean;
}
