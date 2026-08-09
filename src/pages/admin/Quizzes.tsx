import { useState } from "react";
import { Plus, Pencil, Trash2, Save, Wand2, RefreshCw, ListChecks } from "lucide-react";
import { useApp } from "../../lib/store";
import { AdminHeader, Table, Td, Badge } from "./AdminUI";
import { toFa } from "../../lib/utils";
import { Modal } from "../../components/ui";
import { QUESTION_CATEGORIES } from "../../lib/data";
import type { Quiz, QuizQuestion } from "../../lib/types";

type Difficulty = "آسان" | "متوسط" | "سخت";

const KIND_LABEL: Record<Quiz["kind"], string> = {
  daily: "روزانه",
  weekly: "هفتگی",
  category: "دسته‌بندی",
};

function emptyQuiz(): Quiz {
  return {
    id: "quiz-" + Date.now(),
    kind: "category",
    title: "",
    category: QUESTION_CATEGORIES[0],
    difficulty: "آسان",
    durationSeconds: 60,
    pointsPerQuestion: 10,
    questions: [],
  };
}

export default function AdminQuizzes() {
  const { quizzes, saveQuiz, deleteQuiz, generateQuiz } = useApp();
  const [editor, setEditor] = useState<Quiz | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [genForm, setGenForm] = useState<{
    kind: Quiz["kind"];
    category: string;
    difficulty: Difficulty;
    title: string;
    count: number;
  }>({
    kind: "category",
    category: QUESTION_CATEGORIES[0],
    difficulty: "آسان",
    title: "",
    count: 6,
  });
  const [genResult, setGenResult] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const runGenerate = (opts?: { replaceId?: string; forceTitle?: string }) => {
    const title =
      opts?.forceTitle ??
      (genForm.title.trim() ||
        (genForm.kind === "daily"
          ? "کوییز روزانه"
          : genForm.kind === "weekly"
            ? "کوییز هفتگی"
            : `کوییز ${genForm.category}`));
    const quiz = generateQuiz({
      kind: genForm.kind,
      category: genForm.category,
      difficulty: genForm.difficulty,
      title,
      count: genForm.count,
      replaceId: opts?.replaceId,
    });
    setGenResult(quiz.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div>
      <AdminHeader
        title="مدیریت کوییزها"
        desc="ایجاد، ویرایش و تولید خودکار کوییزهای روزانه، هفتگی و دسته‌بندی"
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setGenOpen(true)} className="btn-secondary btn-md">
              <Wand2 size={15} /> تولید خودکار
            </button>
            <button
              onClick={() => {
                setIsNew(true);
                setEditor(emptyQuiz());
              }}
              className="btn-primary btn-md"
            >
              <Plus size={15} /> کوییز جدید
            </button>
          </div>
        }
      />

      {saved && (
        <div className="card mb-6 border border-teal/25 p-4 text-sm text-teal animate-fade-in">
          ✓ تغییرات ذخیره و در بخش کوییز سایت اعمال شد.
        </div>
      )}

      <Table head={["کوییز", "نوع", "دسته‌بندی", "سطح", "سؤالات", "زمان", "اقدامات"]}>
        {quizzes.map((q) => (
          <tr key={q.id} className="transition-colors hover:bg-surface2/30">
            <Td>
              <p className="font-bold">{q.title}</p>
              <p className="text-[11px] text-muted" dir="ltr">
                {q.id}
              </p>
            </Td>
            <Td>
              <Badge tone={q.kind === "daily" ? "info" : q.kind === "weekly" ? "warn" : "default"}>
                {KIND_LABEL[q.kind]}
              </Badge>
            </Td>
            <Td className="text-xs text-muted">{q.category}</Td>
            <Td>
              <Badge
                tone={
                  q.difficulty === "سخت" ? "danger" : q.difficulty === "متوسط" ? "warn" : "success"
                }
              >
                {q.difficulty}
              </Badge>
            </Td>
            <Td>{toFa(q.questions.length)}</Td>
            <Td className="text-xs text-muted">{toFa(Math.ceil(q.durationSeconds / 60))} دقیقه</Td>
            <Td>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setIsNew(false);
                    setEditor(structuredClone(q));
                  }}
                  className="btn-ghost btn-sm !px-2 text-sky"
                  title="ویرایش"
                  aria-label={`ویرایش ${q.title}`}
                >
                  <Pencil size={14} />
                </button>
                {q.kind !== "category" && (
                  <button
                    onClick={() => {
                      setGenForm((f) => ({
                        ...f,
                        kind: q.kind,
                        category: q.category,
                        difficulty: q.difficulty,
                      }));
                      runGenerate({
                        replaceId: q.id,
                        forceTitle: q.title,
                      });
                    }}
                    className="btn-ghost btn-sm !px-2 text-warn"
                    title="بازتولید از بانک سؤال"
                    aria-label={`بازتولید ${q.title}`}
                  >
                    <RefreshCw size={14} />
                  </button>
                )}
                <button
                  onClick={() => setConfirmDel(q.id)}
                  className="btn-ghost btn-sm !px-2 text-danger"
                  title="حذف"
                  aria-label={`حذف ${q.title}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <ListChecks size={14} className="text-sky" />
        دکمه «تولید خودکار» کوییز را از بانک سؤال پلتفرم (بخش تنظیمات) با سؤال‌های تصادفی می‌سازد؛
        برای کوییز روزانه/هفتگی می‌توانید با دکمه بازتولید، سؤال‌ها را هر روز به‌روز کنید.
      </p>

      {/* delete confirm */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="حذف کوییز">
        <div className="space-y-4">
          <p className="text-sm leading-7 text-muted">
            این کوییز به‌همراه تمام سؤال‌هایش حذف می‌شود و از صفحه کوییز سایت خارج می‌شود. مطمئن
            هستید؟
          </p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDel(null)} className="btn-secondary btn-md flex-1">
              انصراف
            </button>
            <button
              onClick={() => {
                deleteQuiz(confirmDel!);
                setConfirmDel(null);
                setSaved(true);
                setTimeout(() => setSaved(false), 1500);
              }}
              className="btn-danger btn-md flex-1"
            >
              <Trash2 size={15} /> حذف کوییز
            </button>
          </div>
        </div>
      </Modal>

      {/* auto-generate */}
      <Modal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        title="تولید خودکار کوییز از بانک سؤال"
        wide
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">نوع کوییز</label>
              <select
                value={genForm.kind}
                onChange={(e) => setGenForm({ ...genForm, kind: e.target.value as Quiz["kind"] })}
                className="input"
              >
                <option value="daily">روزانه</option>
                <option value="weekly">هفتگی</option>
                <option value="category">دسته‌بندی</option>
              </select>
            </div>
            <div>
              <label className="label">دسته‌بندی</label>
              <select
                value={genForm.category}
                onChange={(e) => setGenForm({ ...genForm, category: e.target.value })}
                className="input"
              >
                {QUESTION_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">سطح دشواری</label>
              <select
                value={genForm.difficulty}
                onChange={(e) =>
                  setGenForm({ ...genForm, difficulty: e.target.value as Difficulty })
                }
                className="input"
              >
                <option>آسان</option>
                <option>متوسط</option>
                <option>سخت</option>
              </select>
            </div>
            <div>
              <label className="label">تعداد سؤال</label>
              <input
                type="number"
                min={1}
                max={20}
                value={genForm.count}
                onChange={(e) => setGenForm({ ...genForm, count: Number(e.target.value) })}
                className="input"
                dir="ltr"
              />
            </div>
          </div>
          <div>
            <label className="label">عنوان کوییز (خالی = پیشنهادی)</label>
            <input
              value={genForm.title}
              onChange={(e) => setGenForm({ ...genForm, title: e.target.value })}
              className="input"
              placeholder="مثلاً: کوییز ابزارهای هوش مصنوعی — مرداد ۱۴۰۴"
            />
          </div>
          <p className="flex items-start gap-2 rounded-lg border border-sky/20 bg-sky/5 p-3.5 text-xs leading-6 text-muted">
            <Wand2 size={14} className="mt-0.5 shrink-0 text-sky" />
            سؤال‌ها به‌صورت تصادفی از بانک سؤال پلتفرم انتخاب می‌شوند (هر سؤال حداکثر یک بار). برای
            کوییز روزانه، هر روز یک کوییز تازه تولید کنید.
          </p>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {genResult && (
                <span className="text-teal">
                  ✓ کوییز جدید ساخته شد (id: <b dir="ltr">{genResult}</b>)
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setGenOpen(false)} className="btn-secondary btn-md">
                بستن
              </button>
              <button onClick={() => runGenerate()} className="btn-primary btn-md">
                <Wand2 size={15} /> تولید کوییز
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* quiz editor */}
      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={isNew ? "کوییز جدید" : "ویرایش کوییز"}
        wide
      >
        {editor && (
          <QuizEditor
            quiz={editor}
            onChange={setEditor}
            onSave={() => {
              saveQuiz(editor);
              setEditor(null);
              setSaved(true);
              setTimeout(() => setSaved(false), 1500);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

/* ───────────────────────────── editor ──────────────────────────────────── */

function QuizEditor({
  quiz,
  onChange,
  onSave,
}: {
  quiz: Quiz;
  onChange: (q: Quiz) => void;
  onSave: () => void;
}) {
  const [qEditor, setQEditor] = useState<QuizQuestion | null>(null);
  const [qNew, setQNew] = useState(false);

  const saveQ = (qq: QuizQuestion) => {
    const exists = quiz.questions.some((x) => x.id === qq.id);
    const questions = exists
      ? quiz.questions.map((x) => (x.id === qq.id ? qq : x))
      : [...quiz.questions, qq];
    onChange({ ...quiz, questions });
    setQEditor(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">عنوان</label>
          <input
            value={quiz.title}
            onChange={(e) => onChange({ ...quiz, title: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">نوع</label>
          <select
            value={quiz.kind}
            onChange={(e) => onChange({ ...quiz, kind: e.target.value as Quiz["kind"] })}
            className="input"
          >
            <option value="daily">روزانه</option>
            <option value="weekly">هفتگی</option>
            <option value="category">دسته‌بندی</option>
          </select>
        </div>
        <div>
          <label className="label">دسته‌بندی</label>
          <select
            value={quiz.category}
            onChange={(e) => onChange({ ...quiz, category: e.target.value })}
            className="input"
          >
            {QUESTION_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">سطح</label>
          <select
            value={quiz.difficulty}
            onChange={(e) => onChange({ ...quiz, difficulty: e.target.value as Difficulty })}
            className="input"
          >
            <option>آسان</option>
            <option>متوسط</option>
            <option>سخت</option>
          </select>
        </div>
        <div>
          <label className="label">زمان کل (ثانیه)</label>
          <input
            type="number"
            value={quiz.durationSeconds}
            onChange={(e) => onChange({ ...quiz, durationSeconds: Number(e.target.value) })}
            className="input"
            dir="ltr"
          />
        </div>
        <div>
          <label className="label">امتیاز هر سؤال</label>
          <input
            type="number"
            value={quiz.pointsPerQuestion}
            onChange={(e) => onChange({ ...quiz, pointsPerQuestion: Number(e.target.value) })}
            className="input"
            dir="ltr"
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line/40 pt-4">
        <h4 className="flex items-center gap-2 font-bold">
          <ListChecks size={15} className="text-sky" /> سؤالات ({toFa(quiz.questions.length)})
        </h4>
        <button
          onClick={() => {
            setQNew(true);
            setQEditor({
              id: "qq" + Date.now(),
              text: "",
              options: ["", "", "", ""],
              correct: 0,
              explanation: "",
            });
          }}
          className="btn-primary btn-sm"
        >
          <Plus size={13} /> افزودن سؤال
        </button>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {quiz.questions.map((qq, i) => (
          <div
            key={qq.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-line/50 bg-surface2/40 p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold">
                {toFa(i + 1)}. {qq.text}
              </p>
              <p className="mt-0.5 truncate text-xs text-teal">
                پاسخ: {qq.options[qq.correct] ?? "—"}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => {
                  setQNew(false);
                  setQEditor(qq);
                }}
                className="btn-ghost btn-sm !px-2 text-sky"
                aria-label="ویرایش سؤال"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() =>
                  onChange({ ...quiz, questions: quiz.questions.filter((x) => x.id !== qq.id) })
                }
                className="btn-ghost btn-sm !px-2 text-danger"
                aria-label="حذف سؤال"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {quiz.questions.length === 0 && (
          <div className="rounded-lg border border-dashed border-line/60 p-6 text-center text-xs text-muted">
            سؤالی اضافه نشده — می‌توانید از تولید خودکار استفاده کنید.
          </div>
        )}
      </div>

      <button
        onClick={onSave}
        disabled={!quiz.title.trim() || quiz.questions.length === 0}
        className="btn-primary btn-md w-full"
      >
        <Save size={15} /> ذخیره کوییز
      </button>

      {/* question editor */}
      <Modal
        open={!!qEditor}
        onClose={() => setQEditor(null)}
        title={qNew ? "افزودن سؤال" : "ویرایش سؤال"}
        wide
      >
        {qEditor && (
          <div className="space-y-4">
            <div>
              <label className="label">متن سؤال</label>
              <textarea
                value={qEditor.text}
                onChange={(e) => setQEditor({ ...qEditor, text: e.target.value })}
                rows={2}
                className="input resize-none"
              />
            </div>
            <div>
              <label className="label">گزینه‌ها (هر گزینه در یک خط)</label>
              <textarea
                value={qEditor.options.join("\n")}
                onChange={(e) =>
                  setQEditor({
                    ...qEditor,
                    options: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                rows={4}
                className="input resize-none"
              />
            </div>
            <div>
              <label className="label">گزینه صحیح (شماره از ۰)</label>
              <input
                type="number"
                value={qEditor.correct}
                onChange={(e) => setQEditor({ ...qEditor, correct: Number(e.target.value) })}
                className="input"
                dir="ltr"
              />
            </div>
            <div>
              <label className="label">توضیح پاسخ (بعد از جواب نمایش داده می‌شود)</label>
              <textarea
                value={qEditor.explanation}
                onChange={(e) => setQEditor({ ...qEditor, explanation: e.target.value })}
                rows={2}
                className="input resize-none"
              />
            </div>
            <button
              onClick={() => saveQ(qEditor)}
              disabled={!qEditor.text.trim()}
              className="btn-primary btn-md w-full"
            >
              <Save size={15} /> {qNew ? "افزودن سؤال" : "ذخیره سؤال"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
