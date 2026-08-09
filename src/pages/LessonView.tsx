import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  StickyNote,
  MessageCircleQuestion,
  Lock,
  PlayCircle,
  FileText,
  Trash2,
  Send,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import VideoPlayer from "../components/VideoPlayer";
import { backendEnabled, backendFetchLessonVideoUrl } from "../lib/backend";
import { useApp } from "../lib/store";
import { cls, toFa, timeAgo } from "../lib/utils";
import { Progress, Modal, Banner, Avatar } from "../components/ui";

export default function LessonView() {
  const { chapterId, lessonId } = useParams();
  const navigate = useNavigate();
  const {
    canViewLesson,
    isLessonComplete,
    toggleLessonComplete,
    state,
    addNote,
    deleteNote,
    askQuestion,
    chapterProgress,
    chapters,
  } = useApp();
  const ch = chapters.find((c) => c.id === chapterId);

  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [qOpen, setQOpen] = useState(false);
  const [qText, setQText] = useState("");
  const [noteDone, setNoteDone] = useState(false);
  const [qDone, setQDone] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [videoDenied, setVideoDenied] = useState(false);

  // In backend mode ask the Edge Function for a short-lived signed URL.
  // Access is re-checked server-side on every request (never trust the client).
  useEffect(() => {
    if (!backendEnabled() || !lessonId) return;
    let alive = true;
    (async () => {
      const res = await backendFetchLessonVideoUrl(lessonId);
      if (!alive) return;
      if (res.denied) setVideoDenied(true);
      else if (res.url) setVideoSrc(res.url);
    })();
    return () => {
      alive = false;
    };
  }, [lessonId]);

  const lesson = ch?.lessons.find((l) => l.id === lessonId);
  const lessonNotes = useMemo(
    () => state.notes.filter((n) => n.lessonId === lessonId),
    [state.notes, lessonId]
  );
  const lessonQuestions = useMemo(
    () => state.lessonQuestions.filter((q) => q.lessonId === lessonId),
    [state.lessonQuestions, lessonId]
  );

  if (!ch || !lesson) {
    return <div className="container-x py-20 text-center text-muted">درس پیدا نشد.</div>;
  }

  const canView = canViewLesson(lesson.id);
  const done = isLessonComplete(lesson.id);
  const idx = ch.lessons.findIndex((l) => l.id === lesson.id);
  const prev = ch.lessons[idx - 1];
  const next = ch.lessons[idx + 1];
  const progress = chapterProgress(ch.id);

  if (!canView) {
    return (
      <div className="container-x max-w-3xl py-16">
        <div className="card overflow-hidden">
          <div className="bg-grid aspect-video bg-navy" />
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full border border-line bg-surface2 text-locked">
              <Lock size={26} />
            </span>
            <h2 className="text-xl font-black">این درس محافظت‌شده است</h2>
            <p className="max-w-md text-sm leading-8 text-muted">
              برای مشاهده «{lesson.title}» ابتدا باید دسترسی فصل «{ch.title}» را خریداری کنید.
              دسترسی هر فصل به‌صورت مستقل فعال می‌شود.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={() => navigate(`/checkout/${ch.id}`)} className="btn-primary btn-md">
                خرید این فصل
              </button>
              <Link to={`/chapters/${ch.id}`} className="btn-secondary btn-md">
                بازگشت به فصل
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-x py-8 sm:py-10">
      {/* top bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs text-muted">
            <Link to={`/chapters/${ch.id}`} className="text-sky hover:underline">
              فصل {toFa(ch.index)}: {ch.title}
            </Link>
            <span>•</span>
            <span>
              درس {toFa(lesson.index)} از {toFa(ch.lessons.length)}
            </span>
          </div>
          <h1 className="truncate text-xl font-black sm:text-2xl">{lesson.title}</h1>
        </div>
        <span className="chip border border-line bg-surface2 text-muted">
          {lesson.kind === "video" ? (
            <PlayCircle size={13} className="text-sky" />
          ) : (
            <FileText size={13} className="text-teal" />
          )}
          {lesson.kind === "video" ? "درس ویدئویی" : "درسنامه متنی"} • {toFa(lesson.duration)} دقیقه
        </span>
      </div>

      {/* chapter progress */}
      <div className="mb-6 flex items-center gap-3">
        <Progress value={progress} className="flex-1" />
        <span className="shrink-0 text-xs font-bold text-sky">{toFa(progress)}٪ فصل</span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* main */}
        <div className="min-w-0">
          {lesson.kind === "video" ? (
            <VideoPlayer
              title={lesson.title}
              captions={lesson.captions}
              locked={videoDenied}
              src={videoSrc}
            />
          ) : (
            <div className="card p-6 sm:p-8">
              <span className="chip mb-4 border border-teal/25 bg-teal/10 text-teal">
                <FileText size={13} /> درسنامه متنی
              </span>
              <article className="prose-fa text-[15px]">
                {lesson.content.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </article>
            </div>
          )}

          {/* action bar */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                toggleLessonComplete(lesson.id);
              }}
              className={done ? "btn-success btn-md" : "btn-secondary btn-md"}
            >
              {done ? (
                <>
                  <CheckCircle2 size={17} /> تکمیل‌شده — لغو
                </>
              ) : (
                <>
                  <CheckCircle2 size={17} /> علامت‌گذاری به‌عنوان تکمیل‌شده
                </>
              )}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setNoteOpen(true);
                  setNoteDone(false);
                }}
                className="btn-ghost btn-md"
              >
                <StickyNote size={16} /> یادداشت
              </button>
              <button
                onClick={() => {
                  setQOpen(true);
                  setQDone(false);
                }}
                className="btn-ghost btn-md"
              >
                <MessageCircleQuestion size={16} /> سؤال از مدرس
              </button>
            </div>
          </div>

          {/* legal note */}
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-line/60 bg-surface2/40 px-4 py-3 text-xs leading-6 text-muted">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-teal" />
            <span>
              این محتوا دارای حقوق مالکیت معنوی آکادمی ایلیت است و فقط برای استفاده شخصی شما فعال
              شده است. دانلود، اشتراک‌گذاری و فروش مجدد آن ممنوع و پیگیری قانونی دارد. ویدئوها از
              طریق لینک‌های امن و زمان‌دار سرو می‌شوند.
            </span>
          </div>

          {/* notes */}
          {lessonNotes.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 flex items-center gap-2 font-bold">
                <StickyNote size={17} className="text-warn" /> یادداشت‌های من (
                {toFa(lessonNotes.length)})
              </h3>
              <div className="space-y-2.5">
                {lessonNotes.map((n) => (
                  <div key={n.id} className="card flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="whitespace-pre-wrap text-sm leading-7 text-muted">{n.text}</p>
                      <p className="mt-1.5 text-[11px] text-locked">{timeAgo(n.createdAt)}</p>
                    </div>
                    <button
                      onClick={() => deleteNote(n.id)}
                      className="btn-ghost btn-sm !px-2 text-danger"
                      aria-label="حذف یادداشت"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* questions */}
          {lessonQuestions.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 flex items-center gap-2 font-bold">
                <MessageCircleQuestion size={17} className="text-sky" /> سؤال‌های ثبت‌شده
              </h3>
              <div className="space-y-2.5">
                {lessonQuestions.map((q) => (
                  <div key={q.id} className="card p-4">
                    <p className="text-sm leading-7 text-muted">{q.text}</p>
                    <p className="mt-1.5 text-[11px] text-locked">{timeAgo(q.createdAt)}</p>
                    <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-surface2/60 p-3">
                      <Avatar name={ch.instructor.name} size="sm" />
                      <p className="text-xs leading-6 text-muted">
                        <b className="text-teal">پاسخ مدرس: </b>
                        ممنون از سؤال خوبتان. در جلسه بعدی این موضوع را کامل بررسی می‌کنیم؛ فعلاً
                        بخش «راهنمای انجام» تمرین‌های این درس را مرور کنید.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* prev / next */}
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {prev ? (
              <Link
                to={`/chapters/${ch.id}/lessons/${prev.id}`}
                className="card group flex items-center gap-3 p-4 transition-colors hover:border-neon/40"
              >
                <ChevronRight
                  size={18}
                  className="shrink-0 text-muted transition-transform group-hover:-translate-x-0.5"
                />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted">درس قبلی</p>
                  <p className="truncate text-sm font-bold">{prev.title}</p>
                </div>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                to={`/chapters/${ch.id}/lessons/${next.id}`}
                className="card group flex items-center justify-end gap-3 p-4 text-left transition-colors hover:border-neon/40"
              >
                <div className="min-w-0 text-left">
                  <p className="text-[11px] text-muted">درس بعدی</p>
                  <p className="truncate text-sm font-bold">{next.title}</p>
                </div>
                <ChevronLeft
                  size={18}
                  className="shrink-0 text-muted transition-transform group-hover:-translate-x-0.5"
                />
              </Link>
            ) : (
              <Link
                to={`/chapters/${ch.id}`}
                className="card group flex items-center justify-end gap-3 p-4 text-left transition-colors hover:border-neon/40"
              >
                <div className="min-w-0 text-left">
                  <p className="text-[11px] text-muted">پایان درس‌های فصل</p>
                  <p className="truncate text-sm font-bold">رفتن به تمرین‌ها</p>
                </div>
                <ChevronLeft
                  size={18}
                  className="shrink-0 text-muted transition-transform group-hover:-translate-x-0.5"
                />
              </Link>
            )}
          </div>
        </div>

        {/* sidebar: lesson list */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="card overflow-hidden">
            <div className="border-b border-line/60 bg-surface2/50 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <BookOpen size={15} className="text-sky" /> فهرست درس‌های فصل
              </h3>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {ch.lessons.map((l) => {
                const active = l.id === lesson.id;
                const lDone = isLessonComplete(l.id);
                return (
                  <Link
                    key={l.id}
                    to={`/chapters/${ch.id}/lessons/${l.id}`}
                    className={cls(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                      active
                        ? "bg-neon/12 shadow-[inset_0_0_0_1px_rgba(47,140,255,0.35)]"
                        : "hover:bg-surface2"
                    )}
                  >
                    <span
                      className={cls(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-md",
                        lDone
                          ? "bg-teal/15 text-teal"
                          : active
                            ? "bg-navy text-sky"
                            : "bg-surface2 text-muted"
                      )}
                    >
                      {lDone ? (
                        <CheckCircle2 size={14} />
                      ) : l.kind === "video" ? (
                        <PlayCircle size={14} />
                      ) : (
                        <FileText size={13} />
                      )}
                    </span>
                    <span
                      className={cls(
                        "min-w-0 flex-1 truncate text-xs font-medium",
                        active ? "text-text" : "text-muted"
                      )}
                    >
                      {l.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-locked">
                      {toFa(l.duration)} دقیقه
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* note modal */}
      <Modal open={noteOpen} onClose={() => setNoteOpen(false)} title="یادداشت شخصی">
        {noteDone ? (
          <Banner
            kind="success"
            title="یادداشت ذخیره شد"
            text="یادداشت شما در همین صفحه و پروفایل قابل مشاهده است."
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-7 text-muted">
              نکته‌ای از این درس را بنویسید تا در مرورهای بعدی استفاده کنید.
            </p>
            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={5}
              placeholder="مثلاً: توکن یعنی قطعات کوچک متن…"
              className="input resize-none"
            />
            <button
              onClick={() => {
                if (!noteText.trim()) return;
                addNote(lesson.id, lesson.title, noteText.trim());
                setNoteText("");
                setNoteDone(true);
              }}
              disabled={!noteText.trim()}
              className="btn-primary btn-md w-full"
            >
              <Send size={15} /> ذخیره یادداشت
            </button>
          </div>
        )}
      </Modal>

      {/* question modal */}
      <Modal open={qOpen} onClose={() => setQOpen(false)} title="سؤال از مدرس">
        {qDone ? (
          <Banner
            kind="success"
            title="سؤال شما ثبت شد"
            text="پاسخ مدرس به‌زودی در همین صفحه نمایش داده می‌شود و به اعلان‌های شما اضافه می‌گردد."
          />
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-7 text-muted">
              سؤال خود را درباره این درس بنویسید. مدرس فصل پاسخ شما را بررسی می‌کند.
            </p>
            <textarea
              autoFocus
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              rows={4}
              placeholder="سؤال شما…"
              className="input resize-none"
            />
            <button
              onClick={() => {
                if (!qText.trim()) return;
                askQuestion(lesson.id, qText.trim());
                setQText("");
                setQDone(true);
              }}
              disabled={!qText.trim()}
              className="btn-primary btn-md w-full"
            >
              <Send size={15} /> ثبت سؤال
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
