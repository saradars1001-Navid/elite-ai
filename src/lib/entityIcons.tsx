import {
  Bot,
  BookOpen,
  Braces,
  Brain,
  Briefcase,
  ChartLine,
  Clapperboard,
  Compass,
  Crown,
  FileText,
  Film,
  Flame,
  Gamepad2,
  GraduationCap,
  Handshake,
  Image,
  Keyboard,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  Music,
  Palette,
  PenLine,
  Presentation,
  Puzzle,
  Rocket,
  Search,
  Settings as SettingsGear,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  Table2,
  Target,
  Trophy,
  Wrench,
  Zap,
} from "lucide-react";
import type { ElementType } from "react";

/**
 * Central emoji→lucide icon map. Every entity that used to carry an emoji
 * (chapters, levels, badges, categories, prompt tools) resolves its display
 * icon through one of the helpers here, so iconography stays consistent and
 * vector-based all over the app.
 */

/* chapters (chapter.id → icon) */
const CHAPTER_ICONS: Record<string, ElementType> = {
  ch1: Brain,
  ch2: Keyboard,
  ch3: PenLine,
  ch4: Palette,
  ch5: Zap,
  ch6: Rocket,
};

export function chapterIcon(chapterId?: string): ElementType {
  return (chapterId && CHAPTER_ICONS[chapterId]) || BookOpen;
}

/* user levels (1–12) */
const LEVEL_ICONS: ElementType[] = [
  Sprout, // 1 تازه‌کار
  PenLine, // 2 زبان‌آموز
  Brain, // 3 علاقه‌مند
  Search, // 4 جستجوگر
  BookOpen, // 5 یادگیرنده
  Compass, // 6 کاوشگر
  Wrench, // 7 مهارت‌آموز
  SettingsGear, // 8 عمل‌گرا
  Briefcase, // 9 حرفه‌ای
  Target, // 10 متخصص
  Crown, // 11 استاد
  Rocket, // 12 نخبه
];

export function levelIcon(level: number): ElementType {
  return LEVEL_ICONS[Math.min(Math.max(level, 1), 12) - 1] ?? Star;
}

/* badges */
const BADGE_ICONS: Record<string, ElementType> = {
  b1: Target,
  b2: BookOpen,
  b3: Palette,
  b4: Rocket,
  b5: Flame,
  b6: Trophy,
  b7: Handshake,
};

export function badgeIcon(badgeId?: string): ElementType {
  return (badgeId && BADGE_ICONS[badgeId]) || Sparkles;
}

/* quiz categories */
const QUIZ_CATEGORY_ICONS: Record<string, ElementType> = {
  "ابزارهای هوش مصنوعی": Wrench,
  پرامپت‌نویسی: PenLine,
  "تولید تصویر": Image,
  "تولید ویدئو": Clapperboard,
  "هوش مصنوعی مولد": Brain,
  کدنویسی: Braces,
  "کدنویسی با AI": Braces,
  "اخلاق و امنیت هوش مصنوعی": ShieldCheck,
};

export function quizCategoryIcon(category?: string): ElementType {
  return (category && QUIZ_CATEGORY_ICONS[category]) || Puzzle;
}

/* AI tool categories (bank of tools) */
const TOOL_CATEGORY_ICONS: Record<string, ElementType> = {
  "چت و دستیار هوشمند": MessageCircle,
  "تولید تصویر": Palette,
  "تولید ویدئو": Film,
  "تولید صدا": Music,
  "تولید موسیقی": Music,
  "تحلیل و نگارش": FileText,
  "ارائه و اسلاید": Presentation,
  طراحی: Palette,
  برنامه‌نویسی: Braces,
  کدنویسی: Braces,
  "تحلیل داده": ChartLine,
  آموزش: GraduationCap,
  بازاریابی: Megaphone,
  "مدیریت کسب‌وکار": Briefcase,
  بهره‌وری: Zap,
  تحلیل: ChartLine,
  جدول: Table2,
  متن: FileText,
};

export function toolCategoryIcon(category?: string): ElementType {
  return (category && TOOL_CATEGORY_ICONS[category]) || Wrench;
}

/* prompt-lab: inline wrappers used by the PromptLab pages */
const PROMPT_CAT_COMPONENTS = {
  image: Image,
  code: Braces,
  chart: ChartLine,
  table: Table2,
  text: FileText,
  bot: Bot,
} as const;

export function CategoryGlyph({ cat }: { cat: string }) {
  const key = (Object.keys(PROMPT_CAT_COMPONENTS) as (keyof typeof PROMPT_CAT_COMPONENTS)[]).find(
    (k) =>
      cat.includes(
        k === "image"
          ? "تصویر"
          : k === "code"
            ? "کد"
            : k === "chart"
              ? "تحلیل"
              : k === "table"
                ? "جدول"
                : "متن"
      )
  );
  const I = key ? PROMPT_CAT_COMPONENTS[key] : Bot;
  return <I size={18} />;
}

export function PromptToolGlyph({ id, size = 18 }: { id: string; size?: number }) {
  const I = promptToolIcon(id);
  return <I size={size} />;
}

/* prompt-lab tool ids (PROMPT_TOOLS) */
const PROMPT_TOOL_ICONS: Record<string, ElementType> = {
  "pt-chatgpt": MessageCircle,
  "pt-claude": Brain,
  "pt-midjourney": Palette,
  "pt-copilot": Braces,
  "pt-gemini": Sparkles,
};

export function promptToolIcon(toolId?: string): ElementType {
  return (toolId && PROMPT_TOOL_ICONS[toolId]) || Bot;
}

/* weekly challenges */
const CHALLENGE_ICONS: Record<string, ElementType> = {
  lesson: BookOpen,
  exercise: LifeBuoy,
  quiz: Gamepad2,
  match: Zap,
  community: MessageCircle,
};

export function challengeIcon(type?: string): ElementType {
  return (type && CHALLENGE_ICONS[type]) || Trophy;
}

/** Inline lucide glyph for a user level — replaces {level.icon} emoji slots. */
export function LevelGlyph({ level, size = 16 }: { level: number; size?: number }) {
  const I = levelIcon(level);
  return <I size={size} />;
}

/** Inline lucide glyph for a chapter, by chapter id. */
export function ChGlyph({ id, size = 18 }: { id?: string; size?: number }) {
  const I = chapterIcon(id);
  return <I size={size} />;
}

/** Inline lucide glyph for a badge, by badge id. */
export function BadgeGlyph({ id, size = 18 }: { id?: string; size?: number }) {
  const I = badgeIcon(id);
  return <I size={size} />;
}

/** Generic fallback glyph (purchase rows, receipts…). */
export function PackGlyph({ id, size = 18 }: { id?: string; size?: number }) {
  const I = chapterIcon(id);
  return <I size={size} />;
}
