import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  ArrowRight,
  KeyRound,
  BookOpen,
  Video,
  FileText,
  ListChecks,
  ClipboardCheck,
  FolderKanban,
} from "lucide-react";
import { useApp } from "../../lib/store";
import { AdminHeader, Table, Td, TRow, Badge, Toggle } from "./AdminUI";
import { price, toFa, uid } from "../../lib/utils";
import { Modal, Tabs } from "../../components/ui";
import { exerciseTypeLabel } from "../../lib/data";
import type { Chapter, Lesson, Exercise, ExamQuestion, Project } from "../../lib/types";

type Level = "مقدماتی" | "متوسط" | "پیشرفته";

/* ───────────────────────────── helpers ─────────────────────────────────── */

function linesToArr(s: string): string[] {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function arrToLines(arr: string[]): string {
  return arr.join("\n");
}

const EMPTY_PROJECT: Project = {
  title: "",
  description: "",
  tasks: [],
  tools: [],
  deliverable: "",
};

function emptyChapter(index: number): Chapter {
  const id = uid("ch");
  return {
    id,
    index,
    title: "فصل جدید",
    subtitle: "",
    description: "",
    level: "مقدماتی",
    instructor: { name: "", role: "" },
    duration: 60,
    price: 0,
    oldPrice: undefined,
    free: true,
    icon: "",
    gradient: "from-[#3B82F6] to-[#57B8FF]",
    prerequisites: [],
    outcome: [],
    completionRate: 0,
    rating: 4.5,
    students: 0,
    previewCount: 1,
    lessons: [],
    exercises: [],
    exam: {
      id: `ex-${id}`,
      chapterId: id,
      title: "آزمون پایان فصل",
      durationMinutes: 20,
      passScore: 70,
      questions: [],
    },
    project: { ...EMPTY_PROJECT },
  };
}

/* ───────────────────────────── main page ───────────────────────────────── */

export default function AdminChapters() {
  const { chapters, saveChapter, deleteChapter, grantAccess } = useApp();
  const [draft, setDraft] = useState<Chapter | null>(null);
  const [tab, setTab] = useState("info");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantChapter, setGrantChapter] = useState<string | null>(null);
  const [grantUser, setGrantUser] = useState("");
  const [saved, setSaved] = useState(false);

  const persist = (next: Chapter) => {
    setDraft(next);
    saveChapter(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  /* ── list view ── */
  if (!draft) {
    return (
      <div>
        <AdminHeader
          title="مدیریت فصل‌ها و درس‌ها"
          desc="افزودن، ویرایش و حذف فصل‌ها؛ قیمت‌گذاری، محتوا و آزمون هر فصل"
          action={
            <button
              onClick={() => {
                setDraft(emptyChapter(chapters.length + 1));
                setTab("info");
              }}
              className="btn-primary btn-md"
            >
              <Plus size={15} /> فصل جدید
            </button>
          }
        />

        {saved && (
          <div className="card mb-6 border border-teal/25 p-4 text-sm text-teal animate-fade-in">
            تغییرات ذخیره و در سایت اعمال شد.
          </div>
        )}

        <Table head={["فصل", "سطح", "درس‌ها", "تمرین‌ها", "قیمت", "وضعیت", "اقدامات"]}>
          {chapters.map((c) => (
            <TRow key={c.id}>
              <Td>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-navy text-lg">
                    {c.icon}
                  </span>
                  <div>
                    <p className="font-bold">{c.title}</p>
                    <p className="text-[11px] text-muted">
                      فصل {toFa(c.index)} — {c.subtitle || c.description.slice(0, 40)}
                    </p>
                  </div>
                </div>
              </Td>
              <Td>
                <Badge tone="info">{c.level}</Badge>
              </Td>
              <Td>{toFa(c.lessons.length)}</Td>
              <Td>{toFa(c.exercises.length)}</Td>
              <Td>
                {c.free ? (
                  <Badge tone="success">رایگان</Badge>
                ) : (
                  <div>
                    <p className="font-bold">{price(c.price)}</p>
                    {c.oldPrice && (
                      <p className="text-[10px] text-muted line-through">{price(c.oldPrice)}</p>
                    )}
                  </div>
                )}
              </Td>
              <Td>
                <Badge tone={c.free ? "success" : "warn"}>{c.free ? "رایگان" : "پولی"}</Badge>
              </Td>
              <Td>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setDraft(structuredClone(c));
                      setTab("info");
                    }}
                    className="btn-ghost btn-sm !px-2 text-sky"
                    title="ویرایش"
                    aria-label={`ویرایش ${c.title}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setConfirmDel(c.id)}
                    className="btn-ghost btn-sm !px-2 text-danger"
                    title="حذف"
                    aria-label={`حذف ${c.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setGrantChapter(c.id);
                      setGrantUser("");
                      setGrantOpen(true);
                    }}
                    className="btn-ghost btn-sm !px-2 text-warn"
                    title="اعطای دسترسی دستی"
                  >
                    <KeyRound size={14} />
                  </button>
                  <Link to={`/chapters/${c.id}`} className="btn-ghost btn-sm">
                    مشاهده
                  </Link>
                </div>
              </Td>
            </TRow>
          ))}
        </Table>

        <p className="mt-4 text-xs text-muted">
          <BookOpen size={13} className="ml-1 inline" />
          برای مدیریت درس‌ها، تمرین‌ها، آزمون و پروژه هر فصل، دکمه ویرایش را بزنید.
        </p>

        <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="حذف فصل">
          <div className="space-y-4">
            <p className="text-sm leading-7 text-muted">
              این فصل به‌همراه تمام درس‌ها، تمرین‌ها و آزمونش به‌صورت دائمی حذف می‌شود. کاربرانی که
              این فصل را خریده‌اند دسترسی خود را از دست می‌دهند. مطمئن هستید؟
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)} className="btn-secondary btn-md flex-1">
                انصراف
              </button>
              <button
                onClick={() => {
                  deleteChapter(confirmDel!);
                  setConfirmDel(null);
                  setSaved(true);
                  setTimeout(() => setSaved(false), 1500);
                }}
                className="btn-danger btn-md flex-1"
              >
                <Trash2 size={15} /> حذف فصل
              </button>
            </div>
          </div>
        </Modal>

        {/* grant modal */}
        <Modal open={grantOpen} onClose={() => setGrantOpen(false)} title="اعطای دسترسی دستی">
          <div className="space-y-4">
            <p className="text-sm leading-7 text-muted">
              دسترسی فصل «{chapters.find((c) => c.id === grantChapter)?.title}» را به یک کاربر اعطا
              کنید.
            </p>
            <div>
              <label className="label">شماره موبایل کاربر</label>
              <input
                value={grantUser}
                onChange={(e) => setGrantUser(e.target.value)}
                placeholder="0912xxxxxxx"
                className="input"
                dir="ltr"
              />
            </div>
            <button
              onClick={() => {
                if (!grantUser.trim()) return;
                grantAccess(grantChapter!);
                setGrantOpen(false);
              }}
              disabled={!grantUser.trim()}
              className="btn-primary btn-md w-full"
            >
              <KeyRound size={15} /> اعطای دسترسی
            </button>
          </div>
        </Modal>
      </div>
    );
  }

  /* ── editor view ── */
  return (
    <div>
      <AdminHeader
        title={chapters.some((c) => c.id === draft.id) ? `ویرایش: ${draft.title}` : "فصل جدید"}
        desc="تغییرات با دکمه ذخیره، بلافاصله در سایت اعمال می‌شود"
        action={
          <div className="flex gap-2">
            <button onClick={() => setDraft(null)} className="btn-secondary btn-md">
              <ArrowRight size={15} /> بازگشت
            </button>
            <button onClick={() => persist(draft)} className="btn-primary btn-md">
              <Save size={15} /> ذخیره تغییرات
            </button>
          </div>
        }
      />

      <Tabs
        items={[
          { id: "info", label: "اطلاعات فصل" },
          { id: "lessons", label: "درس‌ها", count: draft.lessons.length },
          { id: "exercises", label: "تمرین‌ها", count: draft.exercises.length },
          { id: "exam", label: "آزمون", count: draft.exam.questions.length },
          { id: "project", label: "پروژه" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-6 space-y-6">
        {tab === "info" && <InfoTab draft={draft} onChange={persist} />}
        {tab === "lessons" && <LessonsTab draft={draft} onChange={persist} />}
        {tab === "exercises" && <ExercisesTab draft={draft} onChange={persist} />}
        {tab === "exam" && <ExamTab draft={draft} onChange={persist} />}
        {tab === "project" && <ProjectTab draft={draft} onChange={persist} />}
      </div>
    </div>
  );
}

/* ───────────────────────────── info tab ────────────────────────────────── */

function InfoTab({ draft, onChange }: { draft: Chapter; onChange: (c: Chapter) => void }) {
  const set = (patch: Partial<Chapter>) => onChange({ ...draft, ...patch });
  return (
    <div className="card space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">شماره فصل</label>
          <input
            type="number"
            value={draft.index}
            onChange={(e) => set({ index: Number(e.target.value) })}
            className="input"
            dir="ltr"
          />
        </div>
        <div>
          <label className="label">عنوان فصل</label>
          <input
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">آیکون (ایموجی)</label>
          <input
            value={draft.icon}
            onChange={(e) => set({ icon: e.target.value })}
            className="input"
            dir="ltr"
          />
        </div>
      </div>
      <div>
        <label className="label">زیرعنوان کوتاه</label>
        <input
          value={draft.subtitle}
          onChange={(e) => set({ subtitle: e.target.value })}
          className="input"
        />
      </div>
      <div>
        <label className="label">توضیح کامل</label>
        <textarea
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={3}
          className="input resize-none"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">سطح</label>
          <select
            value={draft.level}
            onChange={(e) => set({ level: e.target.value as Level })}
            className="input"
          >
            <option>مقدماتی</option>
            <option>متوسط</option>
            <option>پیشرفته</option>
          </select>
        </div>
        <div>
          <label className="label">مدت زمان (دقیقه)</label>
          <input
            type="number"
            value={draft.duration}
            onChange={(e) => set({ duration: Number(e.target.value) })}
            className="input"
            dir="ltr"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">قیمت (تومان)</label>
          <input
            type="number"
            value={draft.price}
            onChange={(e) => set({ price: Number(e.target.value) })}
            className="input"
            dir="ltr"
          />
        </div>
        <div>
          <label className="label">قیمت قبل از تخفیف (اختیاری)</label>
          <input
            type="number"
            value={draft.oldPrice ?? ""}
            onChange={(e) => set({ oldPrice: e.target.value ? Number(e.target.value) : undefined })}
            className="input"
            dir="ltr"
          />
        </div>
        <div className="flex items-end pb-1">
          <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-line/60 bg-surface2/40 px-4 py-2.5">
            <span className="text-sm font-bold">فصل رایگان</span>
            <Toggle on={!!draft.free} onChange={(v) => set({ free: v })} label="رایگان بودن فصل" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">نام مدرس</label>
          <input
            value={draft.instructor.name}
            onChange={(e) => set({ instructor: { ...draft.instructor, name: e.target.value } })}
            className="input"
          />
        </div>
        <div>
          <label className="label">عنوان مدرس</label>
          <input
            value={draft.instructor.role}
            onChange={(e) => set({ instructor: { ...draft.instructor, role: e.target.value } })}
            className="input"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">تعداد درس‌های پیش‌نمایش رایگان</label>
          <input
            type="number"
            value={draft.previewCount}
            onChange={(e) => set({ previewCount: Number(e.target.value) })}
            className="input"
            dir="ltr"
          />
        </div>
        <div>
          <label className="label">نرخ تکمیل (٪)</label>
          <input
            type="number"
            value={draft.completionRate}
            onChange={(e) => set({ completionRate: Number(e.target.value) })}
            className="input"
            dir="ltr"
          />
        </div>
        <div>
          <label className="label">تعداد دانشجو</label>
          <input
            type="number"
            value={draft.students}
            onChange={(e) => set({ students: Number(e.target.value) })}
            className="input"
            dir="ltr"
          />
        </div>
      </div>
      <div>
        <label className="label">پیش‌نیازها (هر مورد در یک خط)</label>
        <textarea
          value={arrToLines(draft.prerequisites)}
          onChange={(e) => set({ prerequisites: linesToArr(e.target.value) })}
          rows={2}
          className="input resize-none"
        />
      </div>
      <div>
        <label className="label">خروجی‌های فصل (هر مورد در یک خط)</label>
        <textarea
          value={arrToLines(draft.outcome)}
          onChange={(e) => set({ outcome: linesToArr(e.target.value) })}
          rows={3}
          className="input resize-none"
        />
      </div>
    </div>
  );
}

/* ───────────────────────────── lessons tab ─────────────────────────────── */

function LessonsTab({ draft, onChange }: { draft: Chapter; onChange: (c: Chapter) => void }) {
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [isNew, setIsNew] = useState(false);

  const saveLesson = (l: Lesson) => {
    const exists = draft.lessons.some((x) => x.id === l.id);
    const lessons = exists
      ? draft.lessons.map((x) => (x.id === l.id ? l : x))
      : [...draft.lessons, l];
    onChange({ ...draft, lessons });
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold">
          <Video size={17} className="text-sky" /> درس‌های فصل ({toFa(draft.lessons.length)})
        </h2>
        <button
          onClick={() => {
            setIsNew(true);
            setEditing({
              id: uid("l"),
              chapterId: draft.id,
              index: draft.lessons.length + 1,
              title: "",
              kind: "video",
              duration: 20,
              summary: "",
              content: [],
              free: draft.free,
              captions: [],
            });
          }}
          className="btn-primary btn-sm"
        >
          <Plus size={14} /> افزودن درس
        </button>
      </div>

      {draft.lessons.length === 0 && !editing && (
        <div className="card p-8 text-center text-sm text-muted">هنوز درسی اضافه نشده است.</div>
      )}

      <div className="space-y-2.5">
        {draft.lessons.map((l) => (
          <div key={l.id} className="card flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy">
                {l.kind === "video" ? (
                  <Video size={16} className="text-sky" />
                ) : (
                  <FileText size={16} className="text-teal" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold">
                  درس {toFa(l.index)}: {l.title}
                </p>
                <p className="truncate text-xs text-muted">
                  {l.summary} • {toFa(l.duration)} دقیقه {l.free ? "• رایگان" : ""}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => {
                  setIsNew(false);
                  setEditing(l);
                }}
                className="btn-ghost btn-sm !px-2 text-sky"
                aria-label="ویرایش درس"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() =>
                  onChange({ ...draft, lessons: draft.lessons.filter((x) => x.id !== l.id) })
                }
                className="btn-ghost btn-sm !px-2 text-danger"
                aria-label="حذف درس"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? "افزودن درس" : "ویرایش درس"}
        wide
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">عنوان درس</label>
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">نوع درس</label>
                <select
                  value={editing.kind}
                  onChange={(e) =>
                    setEditing({ ...editing, kind: e.target.value as Lesson["kind"] })
                  }
                  className="input"
                >
                  <option value="video">ویدئویی</option>
                  <option value="text">متن (درسنامه)</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">مدت (دقیقه)</label>
                <input
                  type="number"
                  value={editing.duration}
                  onChange={(e) => setEditing({ ...editing, duration: Number(e.target.value) })}
                  className="input"
                  dir="ltr"
                />
              </div>
              <div className="flex items-end pb-1">
                <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-line/60 bg-surface2/40 px-4 py-2.5">
                  <span className="text-sm font-bold">درس رایگان (بدون خرید)</span>
                  <Toggle
                    on={!!editing.free}
                    onChange={(v) => setEditing({ ...editing, free: v })}
                    label="رایگان بودن درس"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="label">خلاصه درس</label>
              <input
                value={editing.summary}
                onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">متن کامل درسنامه (هر پاراگراف در یک خط)</label>
              <textarea
                value={arrToLines(editing.content)}
                onChange={(e) => setEditing({ ...editing, content: linesToArr(e.target.value) })}
                rows={6}
                className="input resize-none"
              />
            </div>
            <div>
              <label className="label">زیرنویس‌ها (با کاما جدا کنید — اختیاری)</label>
              <input
                value={editing.captions?.join("، ") ?? ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    captions: e.target.value
                      .split("،")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="input"
              />
            </div>
            <button
              onClick={() => saveLesson(editing)}
              disabled={!editing.title.trim()}
              className="btn-primary btn-md w-full"
            >
              <Save size={15} /> {isNew ? "افزودن درس" : "ذخیره درس"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ───────────────────────────── exercises tab ───────────────────────────── */

function ExercisesTab({ draft, onChange }: { draft: Chapter; onChange: (c: Chapter) => void }) {
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [isNew, setIsNew] = useState(false);

  const saveEx = (e: Exercise) => {
    const exists = draft.exercises.some((x) => x.id === e.id);
    const exercises = exists
      ? draft.exercises.map((x) => (x.id === e.id ? e : x))
      : [...draft.exercises, e];
    onChange({ ...draft, exercises });
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-bold">
          <ListChecks size={17} className="text-teal" /> تمرین‌های فصل (
          {toFa(draft.exercises.length)})
        </h2>
        <button
          onClick={() => {
            setIsNew(true);
            setEditing({
              id: uid("e"),
              chapterId: draft.id,
              index: draft.exercises.length + 1,
              title: "",
              type: "mcq",
              problem: "",
              goal: "",
              guide: [],
              points: 10,
              options: [],
              sampleAnswer: "",
            });
          }}
          className="btn-primary btn-sm"
        >
          <Plus size={14} /> افزودن تمرین
        </button>
      </div>

      {draft.exercises.length === 0 && !editing && (
        <div className="card p-8 text-center text-sm text-muted">هنوز تمرینی اضافه نشده است.</div>
      )}

      <div className="space-y-2.5">
        {draft.exercises.map((e) => (
          <div key={e.id} className="card flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="truncate font-bold">
                تمرین {toFa(e.index)}: {e.title}
              </p>
              <p className="truncate text-xs text-muted">
                {exerciseTypeLabel(e.type)} • {toFa(e.points)} امتیاز
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => {
                  setIsNew(false);
                  setEditing(e);
                }}
                className="btn-ghost btn-sm !px-2 text-sky"
                aria-label="ویرایش تمرین"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() =>
                  onChange({ ...draft, exercises: draft.exercises.filter((x) => x.id !== e.id) })
                }
                className="btn-ghost btn-sm !px-2 text-danger"
                aria-label="حذف تمرین"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? "افزودن تمرین" : "ویرایش تمرین"}
        wide
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">عنوان تمرین</label>
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">نوع تمرین</label>
                <select
                  value={editing.type}
                  onChange={(e) =>
                    setEditing({ ...editing, type: e.target.value as Exercise["type"] })
                  }
                  className="input"
                >
                  <option value="mcq">چهارگزینه‌ای</option>
                  <option value="truefalse">درست و غلط</option>
                  <option value="short">پاسخ کوتاه</option>
                  <option value="ordering">مرتب‌سازی مراحل</option>
                  <option value="prompt-choice">انتخاب بهترین پرامپت</option>
                  <option value="practical">تمرین عملی</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">توضیح مسئله</label>
                <textarea
                  value={editing.problem}
                  onChange={(e) => setEditing({ ...editing, problem: e.target.value })}
                  rows={3}
                  className="input resize-none"
                />
              </div>
              <div>
                <label className="label">هدف تمرین</label>
                <textarea
                  value={editing.goal}
                  onChange={(e) => setEditing({ ...editing, goal: e.target.value })}
                  rows={3}
                  className="input resize-none"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">امتیاز</label>
                <input
                  type="number"
                  value={editing.points}
                  onChange={(e) => setEditing({ ...editing, points: Number(e.target.value) })}
                  className="input"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="label">ابزار پیشنهادی (اختیاری)</label>
                <input
                  value={editing.tool ?? ""}
                  onChange={(e) => setEditing({ ...editing, tool: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="label">
                گزینه‌ها (هر گزینه در یک خط — برای چهارگزینه‌ای و مرتب‌سازی)
              </label>
              <textarea
                value={arrToLines(editing.options ?? [])}
                onChange={(e) => setEditing({ ...editing, options: linesToArr(e.target.value) })}
                rows={4}
                className="input resize-none"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">گزینه صحیح (شماره از ۰)</label>
                <input
                  type="number"
                  value={editing.correctIndex ?? 0}
                  onChange={(e) => setEditing({ ...editing, correctIndex: Number(e.target.value) })}
                  className="input"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="label">پاسخ درست/غلط</label>
                <select
                  value={String(editing.correctBool)}
                  onChange={(e) =>
                    setEditing({ ...editing, correctBool: e.target.value === "true" })
                  }
                  className="input"
                >
                  <option value="true">درست</option>
                  <option value="false">نادرست</option>
                </select>
              </div>
              <div>
                <label className="label">راهنما (هر خط یک مورد)</label>
                <textarea
                  value={arrToLines(editing.guide)}
                  onChange={(e) => setEditing({ ...editing, guide: linesToArr(e.target.value) })}
                  rows={1}
                  className="input resize-none"
                />
              </div>
            </div>
            <div>
              <label className="label">پاسخ نمونه / راهنمای ارزیابی</label>
              <textarea
                value={editing.sampleAnswer}
                onChange={(e) => setEditing({ ...editing, sampleAnswer: e.target.value })}
                rows={3}
                className="input resize-none"
              />
            </div>
            <button
              onClick={() => saveEx(editing)}
              disabled={!editing.title.trim()}
              className="btn-primary btn-md w-full"
            >
              <Save size={15} /> {isNew ? "افزودن تمرین" : "ذخیره تمرین"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ───────────────────────────── exam tab ────────────────────────────────── */

function ExamTab({ draft, onChange }: { draft: Chapter; onChange: (c: Chapter) => void }) {
  const [editing, setEditing] = useState<ExamQuestion | null>(null);
  const [isNew, setIsNew] = useState(false);
  const exam = draft.exam;

  const setExam = (patch: Partial<Chapter["exam"]>) =>
    onChange({ ...draft, exam: { ...exam, ...patch } });

  const saveQ = (q: ExamQuestion) => {
    const exists = exam.questions.some((x) => x.id === q.id);
    const questions = exists
      ? exam.questions.map((x) => (x.id === q.id ? q : x))
      : [...exam.questions, q];
    setExam({ questions });
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="card space-y-4 p-6">
        <h2 className="flex items-center gap-2 font-bold">
          <ClipboardCheck size={17} className="text-sky" /> آزمون پایان فصل
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">عنوان آزمون</label>
            <input
              value={exam.title}
              onChange={(e) => setExam({ title: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="label">مدت (دقیقه)</label>
            <input
              type="number"
              value={exam.durationMinutes}
              onChange={(e) => setExam({ durationMinutes: Number(e.target.value) })}
              className="input"
              dir="ltr"
            />
          </div>
          <div>
            <label className="label">حداقل نمره قبولی</label>
            <input
              type="number"
              value={exam.passScore}
              onChange={(e) => setExam({ passScore: Number(e.target.value) })}
              className="input"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-bold">سؤالات آزمون ({toFa(exam.questions.length)})</h3>
        <button
          onClick={() => {
            setIsNew(true);
            setEditing({
              id: uid("q"),
              text: "",
              options: ["", "", "", ""],
              correct: 0,
              topic: "مفاهیم پایه",
            });
          }}
          className="btn-primary btn-sm"
        >
          <Plus size={14} /> افزودن سؤال
        </button>
      </div>

      <div className="space-y-2.5">
        {exam.questions.map((q, i) => (
          <div key={q.id} className="card flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="truncate font-bold">
                {toFa(i + 1)}. {q.text}
              </p>
              <p className="truncate text-xs text-muted">
                {q.options[q.correct] ?? "—"} • موضوع: {q.topic}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => {
                  setIsNew(false);
                  setEditing(q);
                }}
                className="btn-ghost btn-sm !px-2 text-sky"
                aria-label="ویرایش سؤال"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => setExam({ questions: exam.questions.filter((x) => x.id !== q.id) })}
                className="btn-ghost btn-sm !px-2 text-danger"
                aria-label="حذف سؤال"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {exam.questions.length === 0 && (
          <div className="card p-8 text-center text-sm text-muted">سؤالی اضافه نشده است.</div>
        )}
      </div>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={isNew ? "افزودن سؤال" : "ویرایش سؤال"}
        wide
      >
        {editing && (
          <div className="space-y-4">
            <div>
              <label className="label">متن سؤال</label>
              <textarea
                value={editing.text}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                rows={2}
                className="input resize-none"
              />
            </div>
            <div>
              <label className="label">گزینه‌ها (هر گزینه در یک خط)</label>
              <textarea
                value={arrToLines(editing.options)}
                onChange={(e) => setEditing({ ...editing, options: linesToArr(e.target.value) })}
                rows={4}
                className="input resize-none"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">گزینه صحیح (شماره از ۰)</label>
                <input
                  type="number"
                  value={editing.correct}
                  onChange={(e) => setEditing({ ...editing, correct: Number(e.target.value) })}
                  className="input"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="label">موضوع (برای تحلیل عملکرد)</label>
                <input
                  value={editing.topic}
                  onChange={(e) => setEditing({ ...editing, topic: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            <button
              onClick={() => saveQ(editing)}
              disabled={!editing.text.trim()}
              className="btn-primary btn-md w-full"
            >
              <Save size={15} /> {isNew ? "افزودن سؤال" : "ذخیره سؤال"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ───────────────────────────── project tab ─────────────────────────────── */

function ProjectTab({ draft, onChange }: { draft: Chapter; onChange: (c: Chapter) => void }) {
  const p = draft.project;
  const set = (patch: Partial<Project>) => onChange({ ...draft, project: { ...p, ...patch } });
  return (
    <div className="card space-y-4 p-6">
      <h2 className="flex items-center gap-2 font-bold">
        <FolderKanban size={17} className="text-warn" /> پروژه نهایی فصل
      </h2>
      <div>
        <label className="label">عنوان پروژه</label>
        <input value={p.title} onChange={(e) => set({ title: e.target.value })} className="input" />
      </div>
      <div>
        <label className="label">توضیح پروژه</label>
        <textarea
          value={p.description}
          onChange={(e) => set({ description: e.target.value })}
          rows={3}
          className="input resize-none"
        />
      </div>
      <div>
        <label className="label">مراحل (هر مرحله در یک خط)</label>
        <textarea
          value={arrToLines(p.tasks)}
          onChange={(e) => set({ tasks: linesToArr(e.target.value) })}
          rows={4}
          className="input resize-none"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">ابزارها (با کاما جدا کنید)</label>
          <input
            value={p.tools.join("، ")}
            onChange={(e) =>
              set({
                tools: e.target.value
                  .split("،")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="input"
          />
        </div>
        <div>
          <label className="label">خروجی قابل تحویل</label>
          <input
            value={p.deliverable}
            onChange={(e) => set({ deliverable: e.target.value })}
            className="input"
          />
        </div>
      </div>
    </div>
  );
}
