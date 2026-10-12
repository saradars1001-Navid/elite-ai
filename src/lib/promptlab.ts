import type { PromptCriterion, PromptScenario, PromptTool, PromptToolResult } from "./types";

/* ───────────────────────── Scoring engine ───────────────────────── */

/**
 * امتیازدهی پرامپت بر اساس ۶ معیار پرامپت‌نویسی حرفه‌ای.
 * هر معیار با الگوهای متنی ساده سنجیده می‌شود تا بدون نیاز به هوش مصنوعی،
 * بازخورد آموزشی معنادار بدهد.
 */
export function evaluatePrompt(
  prompt: string,
  _scenario: PromptScenario
): {
  criteria: PromptCriterion[];
  score: number;
  maxScore: number;
  tips: string[];
} {
  const p = prompt.trim();
  const lower = p.toLowerCase();

  const criteria: PromptCriterion[] = [
    {
      key: "role",
      label: "تعیین نقش",
      hint: "به مدل بگویید با چه نقشی پاسخ دهد (مثلاً «تو یک تحلیلگر داده هستی»).",
      max: 20,
      ok: /تو یک|تو نقش|به عنوان|شما یک|تو که/.test(p),
      points: 0,
    },
    {
      key: "context",
      label: "زمینه و هدف",
      hint: "مخاطب، بستر یا هدف استفاده از خروجی را مشخص کنید.",
      max: 20,
      ok: /برای|مخاطب|زمینه|هدف|در حوزه|مشتری|دوره|برند/.test(lower),
      points: 0,
    },
    {
      key: "task",
      label: "وظیفهٔ مشخص",
      hint: "دقیقاً بگویید چه چیزی تولید شود (بنویس، بساز، تحلیل کن، مقایسه کن…).",
      max: 20,
      ok: /(بنویس|بساز|تحلیل|مقایسه|خلاصه|ترجمه|تولید|طراحی|کد|تابع|جدول|پست|ایمیل|کپشن|مرتب)/.test(
        lower
      ),
      points: 0,
    },
    {
      key: "format",
      label: "قالب خروجی",
      hint: "فرمت خروجی را تعیین کنید (جدول، لیست، کد، پاراگراف، تعداد کلمه…).",
      max: 20,
      ok: /(جدول|لیست|کد|پاراگراف|کلمه|خط|ستون|نسبت|هشتگ|خروجی:|فرمت)/.test(lower),
      points: 0,
    },
    {
      key: "detail",
      label: "جزئیات و داده",
      hint: "داده ورودی، ویژگی‌ها یا جزئیات موردنیاز را بنویسید.",
      max: 20,
      ok: p.length >= 60 || /مثال|داده|ویژگی|جزئیات|شامل|عدد|\d/.test(p),
      points: 0,
    },
    {
      key: "constraint",
      label: "محدودیت و لحن",
      hint: "محدودیت طول، سبک، لحن یا موارد ممنوع را مشخص کنید.",
      max: 20,
      ok: /(حداکثر|حداقل|بدون|کوتاه|لحن|صمیمی|حرفه‌ای|مؤدبانه|انگیزشی|محترمانه|ممنوع)/.test(lower),
      points: 0,
    },
  ];

  // به هر معیار امتیاز کامل یا نیم
  const applied = criteria.map((c) => {
    const pts = c.ok ? c.max : Math.max(0, Math.round(c.max * (p.length / 140)));
    return { ...c, points: pts };
  });
  const maxScore = criteria.reduce((a, c) => a + c.max, 0);
  const score = applied.reduce((a, c) => a + c.points, 0);

  const missing = applied.filter((c) => c.points < c.max / 2);
  const tips = missing.map((c) => `${c.label}: ${c.hint}`);

  return {
    criteria: applied,
    score: Math.min(maxScore, score),
    maxScore,
    tips,
  };
}

/* ───────────────────── Simulated tool outputs ───────────────────── */

/** هش ساده و پایدار برای انتخاب شبه‌تصادفی بر اساس پرامپت. */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** کوتاه‌کردن پرامپت برای استفاده در متن نمونه. */
function excerpt(prompt: string, n = 7): string {
  const words = prompt.trim().split(/\s+/);
  return words.slice(0, n).join(" ") + (words.length > n ? "…" : "");
}

/**
 * خروجی شبیه‌سازی‌شده برای یک ابزار — با ساختار ثابت و شبه‌تصادفی،
 * تا هر پرامپت پاسخ متفاوتی بگیرد. صراحتاً آموزشی است.
 */
export function simulateToolOutput(
  tool: PromptTool,
  scenario: PromptScenario,
  prompt: string
): PromptToolResult {
  const seed = hash(prompt + tool.id + scenario.id);
  const ex = excerpt(prompt);

  const commonIntro =
    scenario.taskType === "تصویر"
      ? `بر اساس درخواست شما («${ex}») صحنهٔ زیر تولید شد:`
      : scenario.taskType === "کد"
        ? `بر اساس درخواست شما («${ex}») کد زیر پیشنهاد می‌شود:`
        : `✅ پاسخ «${tool.name}» به درخواست شما («${ex}») — سبک پاسخ: ${tool.style}:`;

  const options =
    scenario.taskType === "تصویر"
      ? [
          `تصویر ۱۶:۹ — نمای عریض از ${ex} با نورپردازی سینمایی، فوکوس نرم، پالت رنگی گرم، سبک مینیمال و کیفیت 4K.`,
          `تصویر عمودی ۹:۱۶ — ترکیب‌بندی مرکزی از ${ex}، پس‌زمینهٔ محو با گرادیان آبی-نارنجی، بافت ظریف و کنتراست بالا.`,
          `تصویر مربعی ۱:۱ — نمای نزدیک از ${ex}، جزئیات ریز لنز و بافت، نور استودیویی ملایم، حال‌وهوای لوکس و مدرن.`,
        ]
      : scenario.taskType === "کد"
        ? [
            `\`\`\`js\n// ${ex}\nfunction run(input) {\n  // بدنهٔ تابع بر اساس نیاز شما\n  const result = input;\n  return result;\n}\n\nexport default run;\n\`\`\`\n\nتوضیح: این پیاده‌سازی ساده با ساختار ورودی/خروجی مشخص است و با داده‌های واقعی قابل تکمیل است.`,
            `\`\`\`ts\n// ${ex}\ntype Item = Record<string, unknown>;\n\nexport function sortByKey<T extends Item>(arr: T[], key: string, asc = true): T[] {\n  return [...arr].sort((a, b) => {\n    const x = String(a[key] ?? "");\n    const y = String(b[key] ?? "");\n    return asc ? x.localeCompare(y) : y.localeCompare(x);\n  });\n}\n\`\`\`\n\nنکته: برای مقادیر عددی از مقایسهٔ عددی استفاده کنید.`,
          ]
        : scenario.taskType === "جدول"
          ? [
              `| مورد | پیشنهاد | دلیل |\n|---|---|---|\n| ${ex} | گزینهٔ اول | ساده و سریع |\n| ادامه | گزینهٔ دوم | دقیق‌تر |\n\nخلاصه: با توجه به ${ex}، شروع از گزینهٔ اول توصیه می‌شود.`,
              `**پیشنهاد جدول**\n\n1. ${ex} — ستون «کاربرد اصلی»\n2. ستون «قیمت» با محدودیت ۸ کلمه\n3. جمع‌بندی در یک پاراگراف کوتاه\n\nاین ساختار به خوانایی و مقایسهٔ سریع کمک می‌کند.`,
            ]
          : scenario.taskType === "تحلیل"
            ? [
                `**تحلیل ${ex}:**\n\n۱. الگوی اصلی: روند صعودی/نزولی در داده‌های شما دیده می‌شود.\n۲. عامل کلیدی: نوسان‌ها به متغیر ورودی وابسته‌اند.\n۳. پیشنهاد: اولویت با بخش‌هایی است که بیشترین بازده را دارند.\n\nدر صورت ارسال دادهٔ کامل، تحلیل دقیق‌تری ارائه می‌شود.`,
                `**خلاصهٔ تحلیلی**\n\n- نقطهٔ قوت: ${ex}\n- ریسک: وابستگی به فرضیات ورودی\n- اقدام پیشنهادی: آزمایش در مقیاس کوچک پیش از تعمیم\n\nمنتظر دادهٔ بیشتر برای عددسازی هستم.`,
              ]
            : [
                `**پاسخ پیشنهادی «${tool.name}»:**\n\nبا توجه به ${ex}، ساختار پیشنهادی من این است:\n\n۱. مقدمه‌ای کوتاه با بیان هدف\n۲. بدنهٔ اصلی در ۲–۳ پاراگراف\n۳. جمع‌بندی با یک دعوت به اقدام\n\nدر صورت تمایل، نسخهٔ رسمی‌تر یا صمیمی‌تر هم می‌توانم بنویسم.`,
                `**نسخهٔ صمیمی:**\n\nسلام! بر اساس ${ex}، این پیشنهاد را آماده کردم:\n\n- بخش اول: معرفی و ارتباط با مخاطب\n- بخش دوم: ارزش اصلی و مزیت‌ها\n- بخش آخر: سؤال روشن برای ادامهٔ گفت‌وگو\n\nاگر لحن یا طول آن را تغییر دهم، بگویید.`,
              ];

  const body = options[seed % options.length];
  const note = `\n\n_خروجی شبیه‌سازی آموزشی — برای نمایش روند کار، با هوش مصنوعی واقعی تولید نشده است._`;

  return { toolId: tool.id, output: `${commonIntro}\n\n${body}${note}` };
}

/* ───────────────────────── helpers ───────────────────────── */

/** Prompt-lab category → lucide icon (was an emoji map). Lives here because
    promptlab stays framework-free; the component wrapper is in entityIcons.tsx. */
export function promptCategoryIcon(
  cat: string
): "image" | "code" | "chart" | "table" | "text" | "bot" {
  const map: Record<string, "image" | "code" | "chart" | "table" | "text" | "bot"> = {
    تصویر: "image",
    کدنویسی: "code",
    تحلیل: "chart",
    جدول: "table",
    متن: "text",
  };
  return map[cat] ?? "bot";
}
