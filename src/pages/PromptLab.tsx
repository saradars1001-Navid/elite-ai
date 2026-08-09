import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Trophy,
  Clock,
  MessageSquareText,
  Wand2,
  History,
  Lock,
} from "lucide-react";
import { useApp } from "../lib/store";
import { categoryEmoji, evaluatePrompt, simulateToolOutput } from "../lib/promptlab";
import { cls, toFa, timeAgo } from "../lib/utils";
import { Progress, EmptyState } from "../components/ui";
import type { PromptTool, PromptToolResult } from "../lib/types";

const TASK_STYLE: Record<string, string> = {
  متن: "border border-sky/25 bg-sky/10 text-sky",
  تصویر: "border border-[#A78BFA]/25 bg-[#8B5CF6]/10 text-[#A78BFA]",
  کد: "border border-teal/25 bg-teal/10 text-teal",
  جدول: "border border-warn/25 bg-warn/10 text-warn",
  تحلیل: "border border-danger/25 bg-danger/10 text-danger",
};

export default function PromptLab() {
  const { user, promptScenarios, promptTools, promptAttempts, submitPromptLab, site } = useApp();

  const [scenarioId, setScenarioId] = useState(promptScenarios[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<PromptToolResult[]>([]);
  const [evaluation, setEvaluation] = useState<ReturnType<typeof evaluatePrompt> | null>(null);
  const [savedAttemptId, setSavedAttemptId] = useState<string | null>(null);
  const [showSample, setShowSample] = useState(false);

  const scenario = promptScenarios.find((s) => s.id === scenarioId) ?? promptScenarios[0];

  // وقتی سناریو عوض می‌شود، ابزارهای پیشنهادی آن انتخاب می‌شوند
  useEffect(() => {
    if (scenario) setSelectedTools(scenario.toolIds);
  }, [scenarioId]); // eslint-disable-line react-hooks/exhaustive-deps

  const availableTools = useMemo(() => {
    if (!scenario) return [];
    return scenario.toolIds
      .map((id) => promptTools.find((t) => t.id === id))
      .filter((t): t is PromptTool => !!t);
  }, [scenario, promptTools]);

  const myAttempts = useMemo(
    () =>
      [...promptAttempts]
        .filter((a) => a.scenarioId === scenarioId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 5),
    [promptAttempts, scenarioId]
  );

  if (!scenario) {
    return (
      <div className="container-x py-14">
        <EmptyState
          icon={<Wand2 size={26} />}
          title="هنوز سناریویی تعریف نشده"
          text="از پنل مدیریت، سناریوی تمرین پرامپت اضافه کنید."
          action={
            user?.role === "admin" ? (
              <Link to="/admin/prompt-lab" className="btn-primary btn-md">
                پنل مدیریت
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const toggleTool = (id: string) =>
    setSelectedTools((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const run = () => {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setResults([]);
    setEvaluation(null);
    setSavedAttemptId(null);
    setShowSample(false);

    const ev = evaluatePrompt(prompt, scenario);
    const tools = availableTools.filter((t) => selectedTools.includes(t.id));
    const outs = tools.map((t) => simulateToolOutput(t, scenario, prompt));

    // خروجی‌ها را یکی‌یکی با تاخیر نمایش بده (حس اجرای واقعی)
    outs.forEach((o, i) => {
      setTimeout(
        () => {
          setResults((prev) => [...prev, o]);
          if (i === outs.length - 1) {
            setEvaluation(ev);
            setRunning(false);
          }
        },
        700 * (i + 1)
      );
    });
  };

  const saveAttempt = () => {
    if (!scenario || !evaluation || savedAttemptId) return;
    const attempt = submitPromptLab({
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      prompt,
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      criteria: evaluation.criteria,
      toolResults: results,
    });
    setSavedAttemptId(attempt.id);
  };

  const pct = evaluation ? Math.round((evaluation.score / evaluation.maxScore) * 100) : 0;

  return (
    <div className="container-x py-8 sm:py-12">
      {/* header */}
      <div className="mb-8">
        <span className="chip mb-3 border border-[#8B5CF6]/25 bg-[#8B5CF6]/10 text-[#A78BFA]">
          <Wand2 size={13} /> آزمایشگاه پرامپت
        </span>
        <h1 className="text-2xl font-black sm:text-3xl">تمرین زنده پرامپت‌نویسی</h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
          یک سناریو انتخاب کن، پرامپتت را بنویس و با چند ابزار نمونه اجرا کن. خروجی‌ها شبیه‌سازی
          آموزشی‌اند تا اصول نوشتن پرامپت را تمرین کنی؛ پرامپتت امتیاز می‌گیرد و بازخورد می‌گیرد.{" "}
          {site.name ? "" : ""}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* ── left: editor ── */}
        <div className="space-y-5">
          {/* step 1: scenario */}
          <section className="card p-5">
            <h2 className="mb-1 flex items-center gap-2 font-bold">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-[#8B5CF6]/15 text-xs font-black text-[#A78BFA]">
                ۱
              </span>
              سناریو را انتخاب کن
            </h2>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {promptScenarios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScenarioId(s.id)}
                  className={cls(
                    "rounded-lg border p-3.5 text-right transition-all",
                    s.id === scenarioId
                      ? "border-[#8B5CF6]/60 bg-[#8B5CF6]/10 shadow-glow-sm"
                      : "border-line/60 bg-surface2/40 hover:border-line hover:bg-surface2"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xl">{categoryEmoji(s.category)}</span>
                    <span className={cls("chip !py-0.5", TASK_STYLE[s.taskType])}>
                      {s.taskType}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold">{s.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted">
                    {s.description}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* step 2: editor */}
          <section className="card p-5">
            <div className="mb-1 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-bold">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-[#8B5CF6]/15 text-xs font-black text-[#A78BFA]">
                  ۲
                </span>
                پرامپتت را بنویس
              </h2>
              {scenario && (
                <span className="flex items-center gap-1 text-[11px] text-muted">
                  <Clock size={12} /> {toFa(scenario.timeSeconds)} ثانیه تمرکز
                </span>
              )}
            </div>
            <p className="mb-3 text-xs leading-6 text-muted">{scenario?.goal}</p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              placeholder="مثلاً: تو یک دستیار اجرایی حرفه‌ای هستی؛ برای مشتری... بنویس..."
              className="input resize-none !text-sm leading-7"
            />
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <span className="text-[11px] text-locked">{toFa(prompt.trim().length)} کاراکتر</span>
              {prompt.trim() && (
                <button
                  onClick={() => setPrompt("")}
                  className="flex items-center gap-1 text-[11px] font-medium text-muted hover:text-text"
                >
                  <RotateCcw size={12} /> پاک کردن
                </button>
              )}
            </div>

            {/* live criteria hint */}
            {prompt.trim().length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 animate-fade-in">
                {evaluatePrompt(prompt, scenario).criteria.map((c) => (
                  <span
                    key={c.key}
                    className={cls(
                      "chip !py-0.5 transition-colors",
                      c.ok
                        ? "border border-teal/25 bg-teal/10 text-teal"
                        : "border border-line/60 bg-surface2 text-locked"
                    )}
                  >
                    {c.ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />} {c.label}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* step 3: tools */}
          {availableTools.length > 0 && (
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-bold">
                <span className="grid h-6 w-6 place-items-center rounded-md bg-[#8B5CF6]/15 text-xs font-black text-[#A78BFA]">
                  ۳
                </span>
                با کدام ابزارها اجرا شود؟
              </h2>
              <div className="flex flex-wrap gap-2">
                {availableTools.map((t) => {
                  const on = selectedTools.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleTool(t.id)}
                      className={cls(
                        "flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-all",
                        on
                          ? "border-[#8B5CF6]/60 bg-[#8B5CF6]/10 text-text"
                          : "border-line/60 bg-surface2/40 text-locked hover:text-text"
                      )}
                    >
                      <span className="text-base">{t.emoji}</span>
                      {t.name}
                      {on && <CheckCircle2 size={14} className="text-[#A78BFA]" />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* run */}
          <button
            onClick={run}
            disabled={!prompt.trim() || selectedTools.length === 0 || running}
            className="btn-primary btn-lg w-full disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                در حال اجرا…
              </span>
            ) : (
              <>
                <Play size={18} /> اجرای پرامپت
              </>
            )}
          </button>

          {/* results */}
          {results.length > 0 && (
            <section className="space-y-4 animate-slide-up">
              <h2 className="flex items-center gap-2 font-black">
                <Sparkles size={17} className="text-[#A78BFA]" /> خروجی ابزارها
              </h2>
              {results.map((r) => {
                const tool = promptTools.find((t) => t.id === r.toolId);
                if (!tool) return null;
                return (
                  <div key={r.toolId} className="card overflow-hidden">
                    <div className="flex items-center gap-2.5 border-b border-line/50 bg-surface2/40 px-4 py-3">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-lg">
                        {tool.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">{tool.name}</p>
                        <p className="text-[10px] text-muted">{tool.style}</p>
                      </div>
                      <span className="chip border border-warn/25 bg-warn/10 text-warn">
                        <Lightbulb size={11} /> شبیه‌سازی آموزشی
                      </span>
                    </div>
                    <pre
                      className="whitespace-pre-wrap px-4 py-4 text-xs leading-6 text-muted"
                      dir="auto"
                    >
                      {r.output}
                    </pre>
                  </div>
                );
              })}

              {/* score */}
              {evaluation && (
                <div className="card overflow-hidden animate-fade-in">
                  <div className="relative p-6">
                    <div className="bg-grid absolute inset-0 opacity-40" />
                    <div className="relative">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="flex items-center gap-2 font-black">
                          <Trophy size={18} className={pct >= 70 ? "text-warn" : "text-muted"} />
                          امتیاز پرامپت شما
                        </h3>
                        <span
                          className={cls(
                            "text-3xl font-black",
                            pct >= 80 ? "text-teal" : pct >= 60 ? "text-warn" : "text-danger"
                          )}
                        >
                          {toFa(pct)}٪
                        </span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {evaluation.criteria.map((c) => (
                          <div key={c.key}>
                            <div className="mb-1 flex items-center justify-between text-xs">
                              <span
                                className={cls(
                                  "font-medium",
                                  c.points >= c.max / 2 ? "text-text" : "text-muted"
                                )}
                              >
                                {c.ok ? (
                                  <CheckCircle2 size={12} className="ml-1 inline text-teal" />
                                ) : (
                                  <XCircle size={12} className="ml-1 inline text-danger" />
                                )}
                                {c.label}
                              </span>
                              <span className="text-muted">
                                {toFa(c.points)}/{toFa(c.max)}
                              </span>
                            </div>
                            <Progress
                              value={(c.points / c.max) * 100}
                              className="h-1.5"
                              color={c.points >= c.max / 2 ? "bg-teal" : "bg-danger/70"}
                            />
                          </div>
                        ))}
                      </div>

                      {evaluation.tips.length > 0 && (
                        <div className="mt-5 rounded-lg border border-warn/25 bg-warn/5 px-4 py-3">
                          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-warn">
                            <Lightbulb size={13} /> برای امتیاز بهتر
                          </p>
                          <ul className="space-y-1 text-xs leading-6 text-muted">
                            {evaluation.tips.map((t) => (
                              <li key={t}>• {t}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        {user ? (
                          savedAttemptId ? (
                            <span className="chip border border-teal/25 bg-teal/10 text-teal">
                              <CheckCircle2 size={13} /> ذخیره شد + امتیاز XP
                            </span>
                          ) : (
                            <button onClick={saveAttempt} className="btn-primary btn-md">
                              <Trophy size={15} /> ذخیره نتیجه
                            </button>
                          )
                        ) : (
                          <Link to="/auth" className="btn-primary btn-md">
                            <Lock size={15} /> برای ذخیره نتیجه وارد شو
                          </Link>
                        )}
                        <button
                          onClick={() => setShowSample((v) => !v)}
                          className="btn-secondary btn-md"
                        >
                          <Lightbulb size={15} /> {showSample ? "پنهان کردن" : "مشاهده"} پرامپت
                          نمونه
                        </button>
                      </div>

                      {showSample && (
                        <div className="mt-4 rounded-lg border border-teal/20 bg-surface2/50 p-4 animate-fade-in">
                          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-teal">
                            <Sparkles size={13} /> پرامپت نمونه (پاسخ ایده‌آل)
                          </p>
                          <p className="text-xs leading-7 text-muted">{scenario.samplePrompt}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* ── right: history ── */}
        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 font-bold">
              <History size={17} className="text-sky" /> تلاش‌های این سناریو
            </h2>
            {myAttempts.length === 0 ? (
              <p className="text-center text-xs leading-6 text-locked">
                هنوز تلاشی ثبت نشده.
                <br />
                پرامپتت را بنویس و «اجرای پرامپت» را بزن.
              </p>
            ) : (
              <div className="space-y-2.5">
                {myAttempts.map((a) => (
                  <div key={a.id} className="rounded-lg border border-line/50 bg-surface2/40 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cls(
                          "text-sm font-black",
                          Math.round((a.score / a.maxScore) * 100) >= 80 ? "text-teal" : "text-warn"
                        )}
                      >
                        {toFa(Math.round((a.score / a.maxScore) * 100))}٪
                      </span>
                      <span className="text-[10px] text-muted">{timeAgo(a.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-5 text-muted" dir="auto">
                      {a.prompt}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* mini guide */}
          <section className="card p-5">
            <h2 className="mb-3 flex items-center gap-2 font-bold">
              <MessageSquareText size={17} className="text-teal" /> فرمول پرامپت خوب
            </h2>
            <ul className="space-y-2 text-[11px] leading-6 text-muted">
              <li className="flex gap-2">
                <span className="font-black text-sky">۱.</span> نقش را مشخص کن — «تو یک … هستی»
              </li>
              <li className="flex gap-2">
                <span className="font-black text-sky">۲.</span> زمینه و مخاطب را بگو
              </li>
              <li className="flex gap-2">
                <span className="font-black text-sky">۳.</span> وظیفه را با فعل روشن بخواه
              </li>
              <li className="flex gap-2">
                <span className="font-black text-sky">۴.</span> قالب خروجی را تعیین کن
              </li>
              <li className="flex gap-2">
                <span className="font-black text-sky">۵.</span> مثال یا داده بده
              </li>
              <li className="flex gap-2">
                <span className="font-black text-sky">۶.</span> محدودیت و لحن را مشخص کن
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
