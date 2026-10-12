/**
 * Export the bundled academy content (src/lib/data.ts) to a JSON file that the
 * Laravel deployment seed imports into MySQL.
 *
 * Usage:  node scripts/export-content.mjs
 * Output: backend/database/academy-content.json
 *
 * The frontend keeps shipping this content inside the bundle for offline use;
 * the export exists so a real backend can serve the same catalog, apply the
 * server-side paywall and let admins edit it.
 */
import { build } from "esbuild";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const work = mkdtempSync(join(tmpdir(), "eaa-content-"));
const bundle = join(work, "data.mjs");

await build({
  entryPoints: [join(root, "src/lib/data.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  outfile: bundle,
  logLevel: "warning",
});

const data = await import(pathToFileURL(bundle).href);

const chapters = data.CHAPTERS.map((c) => ({
  id: c.id,
  index: c.index,
  title: c.title,
  subtitle: c.subtitle,
  description: c.description,
  level: c.level,
  instructor_name: c.instructor?.name ?? "",
  instructor_role: c.instructor?.role ?? "",
  duration_minutes: c.duration,
  price: c.price,
  old_price: c.oldPrice ?? null,
  free: Boolean(c.free),
  preview_count: c.previewCount,
  icon: c.icon ?? "",
  gradient: c.gradient ?? "",
  prerequisites: c.prerequisites ?? [],
  outcome: c.outcome ?? [],
  lessons: (c.lessons ?? []).map((l) => ({
    id: l.id,
    chapter_id: l.chapterId,
    index: l.index,
    title: l.title,
    kind: l.kind,
    duration: l.duration,
    summary: l.summary ?? "",
    content: l.content ?? [],
    captions: l.captions ?? null,
    free: Boolean(l.free),
  })),
  exam: c.exam
    ? {
        id: c.exam.id,
        chapter_id: c.exam.chapterId,
        title: c.exam.title,
        duration_minutes: c.exam.durationMinutes,
        pass_score: c.exam.passScore,
        questions: (c.exam.questions ?? []).map((q) => ({
          id: q.id,
          exam_id: c.exam.id,
          text: q.text,
          options: q.options,
          correct: q.correct,
          topic: q.topic ?? "عمومی",
        })),
      }
    : null,
}));

const quizzes = data.QUIZZES.map((q) => ({
  id: q.id,
  kind: q.kind,
  title: q.title,
  category: q.category,
  difficulty: q.difficulty,
  duration_seconds: q.durationSeconds,
  points_per_question: q.pointsPerQuestion,
  status: "published",
  questions: (q.questions ?? []).map((qq, i) => ({
    id: qq.id,
    quiz_id: q.id,
    text: qq.text,
    options: qq.options,
    correct: qq.correct,
    explanation: qq.explanation ?? "",
    position: i,
  })),
}));

const aiTools = data.AI_TOOLS.map((t) => ({
  id: t.id,
  name: t.name,
  tagline: t.tagline,
  description: t.description,
  category: t.category,
  use_cases: t.useCases ?? [],
  level: t.level,
  pricing: t.pricing,
  languages: t.languages ?? [],
  url: t.url,
  rating: t.rating,
  reviews: t.reviews,
  related_lessons: t.relatedLessons ?? [],
  reviewed_at: t.reviewedAt || null,
  is_new: Boolean(t.isNew),
}));

const shortVideos = data.SHORT_VIDEOS.map((v) => ({
  id: v.id,
  title: v.title,
  creator: v.creator,
  creator_role: v.creatorRole ?? "",
  category: v.category,
  description: v.description ?? "",
  video_path: v.videoUrl,
  poster_path: v.posterUrl ?? null,
  duration_seconds: v.durationSeconds,
  tags: v.tags ?? [],
  views: v.views,
  likes: v.likes,
  status: "published",
  featured: Boolean(v.featured),
}));

const trendingPrompts = data.TRENDING_PROMPTS.map((p) => ({
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
  status: "published",
  featured: Boolean(p.featured),
}));

const communityPosts = data.COMMUNITY_POSTS.map((p) => ({
  author_name: p.author?.name ?? "کاربر",
  author_role: p.author?.role ?? "کاربر",
  category: p.category,
  title: p.title,
  body: p.body,
  tags: p.tags ?? [],
  likes: p.likes,
  comments_count: p.commentsCount,
  status: p.status === "closed" ? "closed" : "open",
}));

const promptTools = data.PROMPT_TOOLS.map((t) => ({
  id: t.id,
  name: t.name,
  emoji: t.emoji ?? "",
  category: t.category,
  description: t.description ?? "",
  style: t.style ?? "",
}));

const promptScenarios = data.PROMPT_SCENARIOS.map((s) => ({
  id: s.id,
  title: s.title,
  description: s.description ?? "",
  category: s.category,
  task_type: s.taskType,
  tool_ids: s.toolIds ?? [],
  sample_prompt: s.samplePrompt ?? "",
  goal: s.goal ?? "",
  time_seconds: s.timeSeconds,
  points: s.points,
  status: "published",
}));

const payload = {
  chapters,
  quizzes,
  aiTools,
  shortVideos,
  trendingPrompts,
  communityPosts,
  promptTools,
  promptScenarios,
};

const target = join(root, "backend/database/academy-content.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(payload));
rmSync(work, { recursive: true, force: true });

console.log(
  `Wrote ${target}\n` +
    `chapters=${chapters.length} lessons=${chapters.reduce((n, c) => n + c.lessons.length, 0)} ` +
    `exams=${chapters.filter((c) => c.exam).length} quizzes=${quizzes.length} ` +
    `tools=${aiTools.length} videos=${shortVideos.length} prompts=${trendingPrompts.length} ` +
    `posts=${communityPosts.length} promptTools=${promptTools.length} scenarios=${promptScenarios.length}`
);
