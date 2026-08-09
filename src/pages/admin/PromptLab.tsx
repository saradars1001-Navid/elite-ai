import { useState } from "react";
import { Save, Plus, Trash2, Pencil, Wand2, History, Sparkles, Users } from "lucide-react";
import { AdminHeader, Badge } from "./AdminUI";
import { useApp } from "../../lib/store";
import { Modal } from "../../components/ui";
import { categoryEmoji } from "../../lib/promptlab";
import { toFa, uid, timeAgo } from "../../lib/utils";
import type { PromptScenario, PromptTool } from "../../lib/types";

const TASK_TYPES = ["متن", "تصویر", "کد", "جدول", "تحلیل"] as const;

const emptyTool = (): PromptTool => ({
  id: uid("pt"),
  name: "",
  emoji: "🤖",
  category: "عمومی",
  description: "",
  style: "",
});

const emptyScenario = (): PromptScenario => ({
  id: uid("ps"),
  title: "",
  description: "",
  category: "نگارش",
  taskType: "متن",
  toolIds: [],
  samplePrompt: "",
  goal: "",
  timeSeconds: 300,
  points: 100,
});

export default function AdminPromptLab() {
  const {
    promptTools,
    promptScenarios,
    promptAttempts,
    savePromptTool,
    deletePromptTool,
    savePromptScenario,
    deletePromptScenario,
  } = useApp();

  const [tab, setTab] = useState<"scenarios" | "tools" | "attempts">("scenarios");
  const [toolEditor, setToolEditor] = useState<PromptTool | null>(null);
  const [scenarioEditor, setScenarioEditor] = useState<PromptScenario | null>(null);
  const [flash, setFlash] = useState(false);

  const notify = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 1500);
  };

  return (
    <div>
      <AdminHeader
        title="آزمایشگاه پرامپت"
        desc="سناریوهای تمرین، ابزارهای نمونه شبیه‌سازی و تلاش‌های کاربران"
        action={
          <span
            className={
              flash ? "chip border border-teal/25 bg-teal/10 text-teal animate-fade-in" : "sr-only"
            }
          >
            <Save size={12} /> ذخیره شد
          </span>
        }
      />

      {/* tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            { id: "scenarios", label: `سناریوها (${toFa(promptScenarios.length)})`, icon: Wand2 },
            { id: "tools", label: `ابزارها (${toFa(promptTools.length)})`, icon: Sparkles },
            {
              id: "attempts",
              label: `تلاش کاربران (${toFa(promptAttempts.length)})`,
              icon: History,
            },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={tab === t.id ? "btn-primary btn-md" : "btn-secondary btn-md"}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ───────── scenarios ───────── */}
      {tab === "scenarios" && (
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              <Wand2 size={17} className="text-[#A78BFA]" /> سناریوهای تمرین
            </h2>
            <button
              onClick={() => setScenarioEditor(emptyScenario())}
              className="btn-primary btn-sm"
            >
              <Plus size={13} /> سناریوی جدید
            </button>
          </div>
          <p className="mb-4 text-xs text-muted">
            هر سناریو یک تکلیف پرامپت‌نویسی است که کاربر در آزمایشگاه تمرین می‌کند.
          </p>
          <div className="space-y-2.5">
            {promptScenarios.map((s) => (
              <div
                key={s.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-line/50 bg-surface2/40 p-3.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg">{categoryEmoji(s.category)}</span>
                    <Badge tone="info">{s.taskType}</Badge>
                    <Badge tone="success">{toFa(s.toolIds.length)} ابزار</Badge>
                    <Badge tone="warn">{toFa(s.points)} امتیاز</Badge>
                  </div>
                  <p className="mt-1.5 text-sm font-bold">{s.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted">{s.description}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setScenarioEditor(s)}
                    className="btn-ghost btn-sm !px-2 text-sky"
                    aria-label="ویرایش سناریو"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => {
                      deletePromptScenario(s.id);
                      notify();
                    }}
                    className="btn-ghost btn-sm !px-2 text-danger"
                    aria-label="حذف سناریو"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ───────── tools ───────── */}
      {tab === "tools" && (
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-bold">
              <Sparkles size={17} className="text-teal" /> ابزارهای نمونه
            </h2>
            <button onClick={() => setToolEditor(emptyTool())} className="btn-primary btn-sm">
              <Plus size={13} /> ابزار جدید
            </button>
          </div>
          <p className="mb-4 text-xs text-muted">
            ابزارهایی که خروجی شبیه‌سازی‌شده برای پرامپت کاربر تولید می‌کنند. هر سناریو از چند ابزار
            استفاده می‌کند.
          </p>
          <div className="space-y-2.5">
            {promptTools.map((t) => (
              <div
                key={t.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-line/50 bg-surface2/40 p-3.5"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-navy text-xl">
                    {t.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">{t.description}</p>
                    <p className="mt-1 text-[10px] text-locked">سبک پاسخ: {t.style || "—"}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setToolEditor(t)}
                    className="btn-ghost btn-sm !px-2 text-sky"
                    aria-label="ویرایش ابزار"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => {
                      deletePromptTool(t.id);
                      notify();
                    }}
                    className="btn-ghost btn-sm !px-2 text-danger"
                    aria-label="حذف ابزار"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ───────── attempts ───────── */}
      {tab === "attempts" && (
        <section className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="flex items-center gap-2 font-bold">
              <History size={17} className="text-sky" /> تلاش‌های کاربران
            </h2>
            <Badge tone="info">{toFa(promptAttempts.length)}</Badge>
          </div>
          {promptAttempts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Users size={22} className="text-locked" />
              <p className="text-sm text-muted">هنوز تلاشی ثبت نشده است.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {[...promptAttempts]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((a) => {
                  const pct = Math.round((a.score / a.maxScore) * 100);
                  return (
                    <details
                      key={a.id}
                      className="group rounded-lg border border-line/50 bg-surface2/40"
                    >
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="text-lg">
                            {categoryEmoji(a.scenarioTitle.includes("تصویر") ? "تصویر" : "نگارش")}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{a.scenarioTitle}</p>
                            <p className="text-[10px] text-muted">{timeAgo(a.createdAt)}</p>
                          </div>
                        </div>
                        <span
                          className={
                            pct >= 80
                              ? "chip border border-teal/25 bg-teal/10 text-teal"
                              : pct >= 60
                                ? "chip border border-warn/25 bg-warn/10 text-warn"
                                : "chip border border-danger/25 bg-danger/10 text-danger"
                          }
                        >
                          {toFa(pct)}٪
                        </span>
                      </summary>
                      <div className="border-t border-line/50 px-4 py-3">
                        <p className="mb-1 text-[10px] font-bold text-locked">پرامپت کاربر</p>
                        <p className="text-xs leading-6 text-muted" dir="auto">
                          {a.prompt}
                        </p>
                        {a.criteria.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {a.criteria.map((c) => (
                              <span
                                key={c.key}
                                className={
                                  c.points >= c.max / 2
                                    ? "chip border border-teal/20 bg-teal/5 text-teal"
                                    : "chip border border-line/60 bg-surface2 text-locked"
                                }
                              >
                                {c.label}: {toFa(c.points)}/{toFa(c.max)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
            </div>
          )}
        </section>
      )}

      {/* tool editor */}
      <Modal
        open={!!toolEditor}
        onClose={() => setToolEditor(null)}
        title={
          toolEditor
            ? promptTools.some((t) => t.id === toolEditor.id)
              ? "ویرایش ابزار"
              : "ابزار جدید"
            : ""
        }
      >
        {toolEditor && (
          <ToolForm
            tool={toolEditor}
            onChange={setToolEditor}
            onSave={() => {
              if (toolEditor.name.trim()) {
                savePromptTool(toolEditor);
                setToolEditor(null);
                notify();
              }
            }}
          />
        )}
      </Modal>

      {/* scenario editor */}
      <Modal
        open={!!scenarioEditor}
        onClose={() => setScenarioEditor(null)}
        title={
          scenarioEditor
            ? promptScenarios.some((s) => s.id === scenarioEditor.id)
              ? "ویرایش سناریو"
              : "سناریوی جدید"
            : ""
        }
        wide
      >
        {scenarioEditor && (
          <ScenarioForm
            scenario={scenarioEditor}
            tools={promptTools}
            onChange={setScenarioEditor}
            onSave={() => {
              if (scenarioEditor.title.trim()) {
                savePromptScenario(scenarioEditor);
                setScenarioEditor(null);
                notify();
              }
            }}
          />
        )}
      </Modal>
    </div>
  );
}

/* ───────────────────────── forms ───────────────────────── */

function ToolForm({
  tool,
  onChange,
  onSave,
}: {
  tool: PromptTool;
  onChange: (t: PromptTool) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[80px_1fr]">
        <div>
          <label className="label">ایموجی</label>
          <input
            value={tool.emoji}
            onChange={(e) => onChange({ ...tool, emoji: e.target.value })}
            className="input text-center text-xl"
          />
        </div>
        <div>
          <label className="label">نام ابزار</label>
          <input
            value={tool.name}
            onChange={(e) => onChange({ ...tool, name: e.target.value })}
            className="input"
            placeholder="مثلاً ChatGPT"
          />
        </div>
      </div>
      <div>
        <label className="label">دسته‌بندی</label>
        <input
          value={tool.category}
          onChange={(e) => onChange({ ...tool, category: e.target.value })}
          className="input"
          placeholder="چت و دستیار هوشمند"
        />
      </div>
      <div>
        <label className="label">توضیح کوتاه</label>
        <input
          value={tool.description}
          onChange={(e) => onChange({ ...tool, description: e.target.value })}
          className="input"
        />
      </div>
      <div>
        <label className="label">سبک پاسخ نمونه</label>
        <input
          value={tool.style}
          onChange={(e) => onChange({ ...tool, style: e.target.value })}
          className="input"
          placeholder="تحلیلی، دقیق و سنجیده"
        />
      </div>
      <button onClick={onSave} disabled={!tool.name.trim()} className="btn-primary btn-md w-full">
        <Save size={15} /> ذخیره ابزار
      </button>
    </div>
  );
}

function ScenarioForm({
  scenario,
  tools,
  onChange,
  onSave,
}: {
  scenario: PromptScenario;
  tools: PromptTool[];
  onChange: (s: PromptScenario) => void;
  onSave: () => void;
}) {
  const toggleTool = (id: string) =>
    onChange({
      ...scenario,
      toolIds: scenario.toolIds.includes(id)
        ? scenario.toolIds.filter((x) => x !== id)
        : [...scenario.toolIds, id],
    });

  return (
    <div className="space-y-4">
      <div>
        <label className="label">عنوان سناریو</label>
        <input
          value={scenario.title}
          onChange={(e) => onChange({ ...scenario, title: e.target.value })}
          className="input"
          placeholder="ایمیل حرفه‌ای به مشتری"
        />
      </div>
      <div>
        <label className="label">توضیح سناریو (وظیفه کاربر)</label>
        <textarea
          value={scenario.description}
          onChange={(e) => onChange({ ...scenario, description: e.target.value })}
          rows={2}
          className="input resize-none"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">دسته‌بندی</label>
          <input
            value={scenario.category}
            onChange={(e) => onChange({ ...scenario, category: e.target.value })}
            className="input"
            placeholder="نگارش"
          />
        </div>
        <div>
          <label className="label">نوع خروجی</label>
          <select
            value={scenario.taskType}
            onChange={(e) =>
              onChange({ ...scenario, taskType: e.target.value as PromptScenario["taskType"] })
            }
            className="input"
          >
            {TASK_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">زمان تمرکز (ثانیه)</label>
          <input
            type="number"
            value={scenario.timeSeconds}
            onChange={(e) => onChange({ ...scenario, timeSeconds: Number(e.target.value) || 0 })}
            className="input"
            dir="ltr"
          />
        </div>
      </div>
      <div>
        <label className="label">هدف تمرین</label>
        <textarea
          value={scenario.goal}
          onChange={(e) => onChange({ ...scenario, goal: e.target.value })}
          rows={2}
          className="input resize-none"
        />
      </div>
      <div>
        <label className="label">پرامپت نمونه (پاسخ ایده‌آل)</label>
        <textarea
          value={scenario.samplePrompt}
          onChange={(e) => onChange({ ...scenario, samplePrompt: e.target.value })}
          rows={4}
          className="input resize-none text-xs leading-6"
        />
      </div>
      <div>
        <label className="label">ابزارهای این سناریو</label>
        <div className="flex flex-wrap gap-2">
          {tools.map((t) => {
            const on = scenario.toolIds.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleTool(t.id)}
                className={
                  on
                    ? "flex items-center gap-1.5 rounded-lg border border-[#8B5CF6]/60 bg-[#8B5CF6]/10 px-3 py-2 text-xs font-bold text-text"
                    : "flex items-center gap-1.5 rounded-lg border border-line/60 bg-surface2 px-3 py-2 text-xs text-muted"
                }
              >
                <span>{t.emoji}</span> {t.name}
              </button>
            );
          })}
        </div>
      </div>
      <button
        onClick={onSave}
        disabled={!scenario.title.trim()}
        className="btn-primary btn-md w-full"
      >
        <Save size={15} /> ذخیره سناریو
      </button>
    </div>
  );
}
