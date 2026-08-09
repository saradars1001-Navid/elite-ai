import { useState } from "react";
import { Pencil, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { AdminHeader, Badge } from "./AdminUI";
import { Modal } from "../../components/ui";
import { useApp } from "../../lib/store";
import { toFa, uid } from "../../lib/utils";
import type { TrendingPrompt } from "../../lib/types";

const empty = (): TrendingPrompt => ({
  id: uid("tp"),
  title: "",
  prompt: "",
  category: "تصویر",
  tool: "",
  author: "تیم Elite AI",
  description: "",
  tags: [],
  uses: 0,
  likes: 0,
  createdAt: new Date().toISOString(),
  status: "draft",
  featured: false,
});
const cats: TrendingPrompt["category"][] = [
  "تصویر",
  "ویدئو",
  "موسیقی",
  "پاورپوینت",
  "متن",
  "کدنویسی",
  "تحلیل",
];

export default function AdminPromptTrends() {
  const { trendingPrompts, saveTrendingPrompt, deleteTrendingPrompt } = useApp();
  const [editor, setEditor] = useState<TrendingPrompt | null>(null);
  return (
    <div>
      <AdminHeader
        title="ترند پرامپت‌ها"
        desc="بانک پرامپت‌های قابل کپی برای تصویر، ویدئو، موسیقی و کارهای واقعی"
        action={
          <button onClick={() => setEditor(empty())} className="btn-primary btn-md">
            <Plus size={15} /> پرامپت جدید
          </button>
        }
      />
      <div className="mb-5 card flex items-center gap-3 border-warn/20 bg-warn/5 p-4 text-sm text-muted">
        <Sparkles className="text-warn" size={20} /> مدیر می‌تواند پرامپت‌های دستی را منتشر کند یا
        بعداً این کالکشن را به سرویس تولید محتوای هوش مصنوعی متصل کند.
      </div>
      <div className="space-y-3">
        {trendingPrompts.map((p) => (
          <div key={p.id} className="card flex flex-wrap items-start gap-4 p-4">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-warn/10 text-xl">
              ✨
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold">{p.title || "بدون عنوان"}</h2>
                <Badge
                  tone={
                    p.status === "published" ? "success" : p.status === "draft" ? "warn" : "default"
                  }
                >
                  {p.status}
                </Badge>
                <Badge tone="info">{p.category}</Badge>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-6 text-muted">{p.prompt}</p>
              <p className="mt-1 text-[10px] text-locked">
                {p.tool} · {toFa(p.uses)} استفاده · {toFa(p.likes)} پسند
              </p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditor(p)} className="btn-ghost btn-sm !px-2 text-sky">
                <Pencil size={14} />
              </button>
              <button
                onClick={() => deleteTrendingPrompt(p.id)}
                className="btn-ghost btn-sm !px-2 text-danger"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!editor} onClose={() => setEditor(null)} title="مدیریت پرامپت ترند" wide>
        {editor && (
          <PromptForm
            value={editor}
            onChange={setEditor}
            onSave={() => {
              if (editor.title.trim() && editor.prompt.trim()) {
                saveTrendingPrompt(editor);
                setEditor(null);
              }
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function PromptForm({
  value,
  onChange,
  onSave,
}: {
  value: TrendingPrompt;
  onChange: (v: TrendingPrompt) => void;
  onSave: () => void;
}) {
  const patch = (p: Partial<TrendingPrompt>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">عنوان</label>
          <input
            className="input"
            value={value.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </div>
        <div>
          <label className="label">دسته</label>
          <select
            className="input"
            value={value.category}
            onChange={(e) => patch({ category: e.target.value as TrendingPrompt["category"] })}
          >
            {cats.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">ابزار</label>
          <input
            className="input"
            value={value.tool}
            onChange={(e) => patch({ tool: e.target.value })}
            placeholder="Midjourney، Suno، Gamma..."
          />
        </div>
        <div>
          <label className="label">نویسنده</label>
          <input
            className="input"
            value={value.author}
            onChange={(e) => patch({ author: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="label">متن پرامپت</label>
        <textarea
          rows={5}
          className="input resize-none text-xs leading-7"
          value={value.prompt}
          onChange={(e) => patch({ prompt: e.target.value })}
        />
      </div>
      <div>
        <label className="label">توضیح</label>
        <textarea
          rows={2}
          className="input resize-none"
          value={value.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">تگ‌ها</label>
          <input
            className="input"
            value={value.tags.join(", ")}
            onChange={(e) =>
              patch({
                tags: e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
        <div>
          <label className="label">وضعیت انتشار</label>
          <select
            className="input"
            value={value.status}
            onChange={(e) => patch({ status: e.target.value as TrendingPrompt["status"] })}
          >
            <option value="draft">پیش‌نویس</option>
            <option value="published">منتشرشده</option>
            <option value="archived">آرشیو</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.featured}
          onChange={(e) => patch({ featured: e.target.checked })}
        />{" "}
        نمایش در بخش ویژه
      </label>
      <button
        onClick={onSave}
        disabled={!value.title.trim() || !value.prompt.trim()}
        className="btn-primary btn-md w-full"
      >
        <Save size={15} /> ذخیره پرامپت
      </button>
    </div>
  );
}
