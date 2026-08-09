import { useState } from "react";
import { Plus, Pencil, Save, Trash2 } from "lucide-react";
import { TOOL_CATEGORIES } from "../../lib/data";
import { useApp } from "../../lib/store";
import { AdminHeader, Table, Td, Badge, faNum } from "./AdminUI";
import { cls, toFa, uid } from "../../lib/utils";
import { Modal } from "../../components/ui";
import type { AiTool } from "../../lib/types";

interface FormState {
  name: string;
  category: string;
  tagline: string;
  description: string;
  pricing: AiTool["pricing"];
  level: AiTool["level"];
  url: string;
  rating: number;
  languages: string;
  useCases: string;
}

const EMPTY: FormState = {
  name: "",
  category: TOOL_CATEGORIES[0],
  tagline: "",
  description: "",
  pricing: "رایگان + پولی",
  level: "آسان",
  url: "",
  rating: 4,
  languages: "فارسی، انگلیسی",
  useCases: "",
};

export default function AdminTools() {
  const { aiTools, saveTool, deleteTool } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saved, setSaved] = useState(false);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setModalOpen(true);
  };

  const openEdit = (id: string) => {
    const t = aiTools.find((x) => x.id === id);
    if (!t) return;
    setEditing(id);
    setForm({
      name: t.name,
      category: t.category,
      tagline: t.tagline,
      description: t.description,
      pricing: t.pricing,
      level: t.level,
      url: t.url,
      rating: t.rating,
      languages: t.languages.join("، "),
      useCases: t.useCases.join("، "),
    });
    setModalOpen(true);
  };

  const submit = () => {
    if (!form.name.trim()) return;
    const lang = form.languages
      .split("،")
      .map((s) => s.trim())
      .filter(Boolean);
    const uses = form.useCases
      .split("،")
      .map((s) => s.trim())
      .filter(Boolean);
    if (editing) {
      const existing = aiTools.find((t) => t.id === editing);
      if (!existing) return;
      saveTool({ ...existing, ...form, languages: lang, useCases: uses });
    } else {
      const tool: AiTool = {
        id: uid("tool"),
        name: form.name.trim(),
        category: form.category,
        tagline: form.tagline,
        description: form.description,
        pricing: form.pricing,
        level: form.level,
        url: form.url,
        rating: form.rating,
        reviews: 0,
        languages: lang,
        useCases: uses,
        relatedLessons: [],
        reviewedAt: new Date().toISOString().slice(0, 10),
        isNew: true,
        output: "—",
      };
      saveTool(tool);
    }
    setModalOpen(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div>
      <AdminHeader
        title="بانک ابزارهای هوش مصنوعی"
        desc={`${faNum(aiTools.length)} ابزار بررسی‌شده — افزودن، ویرایش و حذف ابزار`}
        action={
          <button onClick={openNew} className="btn-primary btn-md">
            <Plus size={15} /> افزودن ابزار {saved && "✓"}
          </button>
        }
      />

      {saved && (
        <div className="card mb-6 border border-teal/25 p-4 text-sm text-teal animate-fade-in">
          ✓ تغییرات ذخیره و در صفحه بانک ابزارها اعمال شد.
        </div>
      )}

      <Table head={["ابزار", "دسته‌بندی", "قیمت", "سطح", "امتیاز", "اقدامات"]}>
        {aiTools.map((t) => (
          <tr key={t.id} className="transition-colors hover:bg-surface2/30">
            <Td>
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy text-base">
                  🛠️
                </span>
                <div>
                  <p className="font-bold">{t.name}</p>
                  <p className="max-w-[220px] truncate text-[11px] text-muted">{t.tagline}</p>
                </div>
              </div>
            </Td>
            <Td className="text-xs text-muted">{t.category}</Td>
            <Td>
              <Badge
                tone={t.pricing === "رایگان" ? "success" : t.pricing === "پولی" ? "warn" : "info"}
              >
                {t.pricing}
              </Badge>
            </Td>
            <Td>
              <Badge>{t.level}</Badge>
            </Td>
            <Td className="font-bold text-warn">{toFa(t.rating)} ★</Td>
            <Td>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(t.id)}
                  className="btn-ghost btn-sm !px-2 text-sky"
                  aria-label="ویرایش"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setConfirmDel(t.id)}
                  className="btn-ghost btn-sm !px-2 text-danger"
                  aria-label="حذف"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>

      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="حذف ابزار">
        <div className="space-y-4">
          <p className="text-sm leading-7 text-muted">
            این ابزار از بانک ابزارها حذف و دیگر در سایت نمایش داده نمی‌شود. مطمئن هستید؟
          </p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDel(null)} className="btn-secondary btn-md flex-1">
              انصراف
            </button>
            <button
              onClick={() => {
                deleteTool(confirmDel!);
                setConfirmDel(null);
                setSaved(true);
                setTimeout(() => setSaved(false), 1500);
              }}
              className="btn-danger btn-md flex-1"
            >
              <Trash2 size={15} /> حذف ابزار
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "ویرایش ابزار" : "افزودن ابزار"}
        wide
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">نام ابزار</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              placeholder="مثلاً ChatGPT"
            />
          </div>
          <div>
            <label className="label">دسته‌بندی</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input"
            >
              {TOOL_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">مدل قیمت‌گذاری</label>
            <select
              value={form.pricing}
              onChange={(e) => setForm({ ...form, pricing: e.target.value as AiTool["pricing"] })}
              className="input"
            >
              <option>رایگان</option>
              <option>پولی</option>
              <option>رایگان + پولی</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">توضیح کوتاه</label>
            <input
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="input"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">توضیح کامل</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="input resize-none"
            />
          </div>
          <div>
            <label className="label">سطح کاربری</label>
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value as AiTool["level"] })}
              className="input"
            >
              <option>آسان</option>
              <option>متوسط</option>
              <option>حرفه‌ای</option>
            </select>
          </div>
          <div>
            <label className="label">امتیاز (۱ تا ۵)</label>
            <input
              type="number"
              min={1}
              max={5}
              step={0.1}
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
              className="input"
              dir="ltr"
            />
          </div>
          <div>
            <label className="label">زبان‌های پشتیبانی‌شده (با کاما)</label>
            <input
              value={form.languages}
              onChange={(e) => setForm({ ...form, languages: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">کاربردهای اصلی (با کاما)</label>
            <input
              value={form.useCases}
              onChange={(e) => setForm({ ...form, useCases: e.target.value })}
              className="input"
              placeholder="مثلاً: نوشتن مقاله، ترجمه، خلاصه‌سازی"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">لینک رسمی</label>
            <input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="input"
              dir="ltr"
              placeholder="https://"
            />
          </div>
        </div>
        <button
          onClick={submit}
          disabled={!form.name.trim()}
          className={cls("btn-primary btn-md mt-5 w-full")}
        >
          <Save size={15} /> {editing ? "ذخیره تغییرات" : "افزودن ابزار"}
        </button>
      </Modal>
    </div>
  );
}
