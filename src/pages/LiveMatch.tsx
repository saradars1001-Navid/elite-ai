import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Swords,
  Clock,
  Trophy,
  Zap,
  RotateCcw,
  Share2,
  Home,
  ChevronLeft,
  Crown,
  Medal,
  Users,
  UserRound,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import { LIVE_MATCH } from "../lib/data";
import { useApp } from "../lib/store";
import { cls, toFa, shuffle, uid } from "../lib/utils";
import { Avatar } from "../components/ui";
import {
  isLaravelConfigured,
  laravelCreateMatch,
  laravelJoinMatch,
  laravelMatchLobby,
  laravelMatchState,
  laravelRematch,
  laravelStartMatch,
  laravelSubmitAnswer,
  type LiveMatchLobbyRow,
  type LiveMatchState,
} from "../lib/laravel";

type Phase = "lobby" | "matching" | "playing" | "result";

interface Bot {
  id: string;
  name: string;
  skill: number;
  color: string;
  answers: boolean[];
  answerTick: number[];
  score: number;
  answeredCount: number;
}

interface Row {
  name: string;
  color: string;
  score: number;
  isUser: boolean;
  icon?: string;
}

const QUESTION_COUNT = LIVE_MATCH.questions;
const QUESTION_SECONDS = LIVE_MATCH.secondsPerQuestion;
const TICK_MS = 500;
const POINTS = LIVE_MATCH.pointsPerQuestion;

const BOT_POOL = [
  { name: "نگار کریمی", skill: 0.62, color: "#57B8FF" },
  { name: "کاوه رحیمی", skill: 0.42, color: "#20D6B5" },
  { name: "النا فرهادی", skill: 0.78, color: "#7C3AED" },
  { name: "سامان توکلی", skill: 0.5, color: "#F59E0B" },
  { name: "ترانه نعمتی", skill: 0.68, color: "#EC4899" },
  { name: "بهراد کیانی", skill: 0.35, color: "#EF4444" },
];

type MatchQuestion = {
  id: string;
  text: string;
  options: string[];
  /** Hidden by the live server until the match finishes. */
  correct?: number;
  explanation?: string;
  /** The viewer's own graded pick — only present after the match finishes. */
  myAnswer?: number | null;
};

function buildMatchQuestions(pool: MatchQuestion[]): MatchQuestion[] {
  return shuffle(pool).slice(0, QUESTION_COUNT);
}

function makeBots(mode: "1v1" | "ffa", questions: { id: string }[]): Bot[] {
  const defs = mode === "1v1" ? [BOT_POOL[1]] : [BOT_POOL[2], BOT_POOL[0], BOT_POOL[3]];
  return defs.map((d) => makeBot(d.name, d.skill, d.color, questions));
}

function makeBot(name: string, skill: number, color: string, questions: { id: string }[]): Bot {
  return {
    id: uid("bot"),
    name,
    skill,
    color,
    answers: questions.map(() => Math.random() < skill),
    answerTick: questions.map(() => 1 + Math.floor(Math.random() * 4)),
    score: 0,
    answeredCount: 0,
  };
}

const rankXp = (rank: number) => (rank === 1 ? 60 : rank === 2 ? 40 : rank === 3 ? 25 : 10);

/** Convert a live match state into the result rows used by the result screen. */
function rowsFromMatch(match: LiveMatchState, viewerName: string): { rows: Row[]; rank: number } {
  const rows: Row[] = match.players.map((p) => ({
    name: p.name,
    color: p.isViewer ? "#3B82F6" : "#57B8FF",
    score: p.score,
    isUser: p.isViewer,
  }));
  if (!rows.some((r) => r.isUser)) {
    rows.push({ name: viewerName, color: "#3B82F6", score: 0, isUser: true });
  }
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const rank = sorted.findIndex((r) => r.isUser) + 1;
  return { rows: sorted, rank };
}

export default function LiveMatch() {
  const navigate = useNavigate();
  const { user, submitMatch, matchStats, quizzes } = useApp();
  const pool = quizzes.flatMap((q) => q.questions);
  const backend = isLaravelConfigured();

  const [phase, setPhase] = useState<Phase>("lobby");
  const [mode, setMode] = useState<"1v1" | "ffa">("ffa");
  const [questions, setQuestions] = useState(() => buildMatchQuestions(pool));
  const [bots, setBots] = useState<Bot[]>(() => makeBots("ffa", buildMatchQuestions(pool)));

  /* ── real match (Laravel) state ── */
  const [match, setMatch] = useState<LiveMatchState | null>(null);
  const [matchId, setMatchId] = useState<number | null>(null);
  const [lobby, setLobby] = useState<LiveMatchLobbyRow[]>([]);
  const [polling, setPolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [matchError, setMatchError] = useState("");
  const lastQuestionIndex = useRef(-1);

  /* ── demo flow state (unchanged) ── */
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [result, setResult] = useState<{ rows: Row[]; rank: number } | null>(null);
  const [shared, setShared] = useState(false);
  const [realTimeLeft, setRealTimeLeft] = useState(QUESTION_SECONDS);
  /* Per-question verdict for real matches, derived from the server's own
     correct-count delta — the answer key itself stays hidden until finish. */
  const [pickVerdicts, setPickVerdicts] = useState<Record<number, "correct" | "wrong">>({});
  const picksRef = useRef<(number | null)[]>([]);

  const tickRef = useRef(0);
  const streakRef = useRef(0);
  const scoreRef = useRef(0);
  const correctRef = useRef(0);
  const botsRef = useRef<Bot[]>([]);
  const revealedRef = useRef(false);
  const finishedRef = useRef(false);
  const nextTimer = useRef<number | null>(null);
  const matchRef = useRef<LiveMatchState | null>(null);
  const finishedRefMatch = useRef(false);

  const ticks = Math.ceil(QUESTION_SECONDS / (TICK_MS / 1000));

  /* Real-match polling: fetch state until the match finishes. */
  useEffect(() => {
    if (!backend || matchId === null || phase !== "playing") return;
    setPolling(true);
    let alive = true;
    const loop = async () => {
      try {
        const fresh = await laravelMatchState(matchId);
        if (!alive) return;
        matchRef.current = fresh;
        setMatch(fresh);
        // A new question arrived from the server → unlock answers.
        if (lastQuestionIndex.current !== -1 && fresh.questionIndex !== lastQuestionIndex.current) {
          setSelected(null);
          setLocked(false);
          revealedRef.current = false;
        }
        lastQuestionIndex.current = fresh.questionIndex;
        if (fresh.status === "finished" && !finishedRefMatch.current) {
          finishedRefMatch.current = true;
          const { rows, rank } = rowsFromMatch(fresh, user?.name || "شما");
          setResult({ rows, rank });
          const myPlayer = fresh.players.find((p) => p.isViewer);
          submitMatch({
            mode: fresh.mode,
            rank,
            players: fresh.players.length,
            score: myPlayer?.score ?? 0,
            correct: myPlayer?.correct ?? 0,
            total: fresh.questions.length,
            won: rank === 1,
          });
          setPhase("result");
          return;
        }
        if (fresh.status === "abandoned") {
          setMatchError("مسابقه لغو شد.");
          setPhase("lobby");
          return;
        }
      } catch {
        /* transient network error — keep polling */
      }
      if (alive) window.setTimeout(loop, 1400);
    };
    void loop();
    return () => {
      alive = false;
      setPolling(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, matchId, phase]);

  /* cleanup timers on unmount */
  useEffect(
    () => () => {
      if (nextTimer.current) window.clearTimeout(nextTimer.current);
    },
    []
  );

  /* demo per-question live clock + bot progression (unchanged) */
  useEffect(() => {
    if (phase !== "playing" || !current || backend) return;
    tickRef.current = 0;
    setTimeLeft(QUESTION_SECONDS);
    const t0 = Date.now();
    const interval = window.setInterval(() => {
      tickRef.current += 1;
      const t = tickRef.current;
      setBots((prev) => {
        const next = prev.map((b) => {
          if (b.answeredCount > idx || t < b.answerTick[idx]) return b;
          return {
            ...b,
            score: b.score + (b.answers[idx] ? POINTS : 0),
            answeredCount: b.answeredCount + 1,
          };
        });
        botsRef.current = next;
        return next;
      });
      setTimeLeft(Math.max(0, QUESTION_SECONDS - Math.floor((Date.now() - t0) / 1000)));
      if (t >= ticks) {
        if (!revealedRef.current) reveal(null);
        window.clearInterval(interval);
      }
    }, TICK_MS);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx]);

  /* demo matching → playing transition (unchanged) */
  useEffect(() => {
    if (phase !== "matching" || backend) return;
    const t = window.setTimeout(() => setPhase("playing"), 1800);
    return () => window.clearTimeout(t);
  }, [phase, backend]);

  /* real-match per-second countdown driven by the server deadline */
  useEffect(() => {
    if (!backend || !match || match.status !== "playing" || !match.questionEndsAt) return;
    const deadline = new Date(match.questionEndsAt).getTime();
    const update = () => setRealTimeLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    update();
    const t = window.setInterval(update, 250);
    return () => window.clearInterval(t);
  }, [backend, match?.id, match?.questionIndex, match?.status, match?.questionEndsAt]);

  /* refresh the open-lobby list while waiting in the real lobby */
  useEffect(() => {
    if (!backend || phase !== "lobby") return;
    let alive = true;
    const load = async () => {
      try {
        const rows = await laravelMatchLobby();
        if (alive) setLobby(rows);
      } catch {
        /* ignore */
      }
    };
    void load();
    const t = window.setInterval(load, 5000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [backend, phase]);

  const current =
    backend && match
      ? (match.questions[match.questionIndex] as MatchQuestion | undefined)
      : questions[idx];
  const currentIdx = backend && match ? match.questionIndex : idx;
  const userRow: Row = {
    name: user?.name || "شما",
    color: "#3B82F6",
    score,
    isUser: true,
  };

  /* ── real match actions ── */

  const createRealMatch = async (m: "1v1" | "ffa") => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setBusy(true);
    setMatchError("");
    try {
      const created = await laravelCreateMatch(m);
      matchRef.current = created;
      setMatch(created);
      setMatchId(created.id);
      lastQuestionIndex.current = created.questionIndex;
      finishedRefMatch.current = false;
      setResult(null);
      setPickVerdicts({});
      picksRef.current = [];
      setPhase("matching");
      if (created.status === "playing") {
        setPhase("playing");
      } else {
        // host may start immediately once joined (there may already be waiters)
        void laravelStartMatch(created.id)
          .then((started) => {
            if (started.status === "playing") {
              matchRef.current = started;
              setMatch(started);
              lastQuestionIndex.current = started.questionIndex;
              setPhase("playing");
            }
          })
          .catch(() => undefined);
      }
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : "ساخت مسابقه ناموفق بود");
      setPhase("lobby");
    } finally {
      setBusy(false);
    }
  };

  const joinRealMatch = async (id: number) => {
    setBusy(true);
    setMatchError("");
    try {
      const joined = await laravelJoinMatch(id);
      matchRef.current = joined;
      setMatch(joined);
      setMatchId(joined.id);
      lastQuestionIndex.current = joined.questionIndex;
      finishedRefMatch.current = false;
      setResult(null);
      setPickVerdicts({});
      picksRef.current = [];
      setPhase(joined.status === "playing" ? "playing" : "matching");
      if (joined.status === "waiting") {
        // wait for the host to start
      }
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : "پیوستن ناموفق بود");
    } finally {
      setBusy(false);
    }
  };

  const answerReal = async (i: number) => {
    if (!match || locked || phase !== "playing" || revealedRef.current) return;
    setSelected(i);
    setLocked(true);
    revealedRef.current = true;
    const answeredIndex = match.questionIndex;
    const beforeCorrect = match.players.find((p) => p.isViewer)?.correct ?? 0;
    try {
      const fresh = await laravelSubmitAnswer(match.id, i, match.questionIndex);
      matchRef.current = fresh;
      lastQuestionIndex.current = fresh.questionIndex;
      setMatch(fresh);
      // The viewer's correct count only grows via their own graded answer,
      // so a delta tells us the verdict without exposing the answer key.
      const afterCorrect = fresh.players.find((p) => p.isViewer)?.correct ?? 0;
      setPickVerdicts((v) => ({
        ...v,
        [answeredIndex]: afterCorrect > beforeCorrect ? "correct" : "wrong",
      }));
      if (fresh.questionIndex !== match.questionIndex) {
        setSelected(null);
        setLocked(false);
        revealedRef.current = false;
      }
      if (fresh.status === "finished" && !finishedRefMatch.current) {
        finishedRefMatch.current = true;
        const { rows, rank } = rowsFromMatch(fresh, user?.name || "شما");
        setResult({ rows, rank });
        const myPlayer = fresh.players.find((p) => p.isViewer);
        submitMatch({
          mode: fresh.mode,
          rank,
          players: fresh.players.length,
          score: myPlayer?.score ?? 0,
          correct: myPlayer?.correct ?? 0,
          total: fresh.questions.length,
          won: rank === 1,
        });
        setPhase("result");
      }
    } catch {
      /* the poller will reconcile the state */
    }
  };

  /* ── demo actions (unchanged) ── */

  const startMatch = () => {
    const qs = buildMatchQuestions(pool);
    setQuestions(qs);
    const freshBots = makeBots(mode, qs);
    botsRef.current = freshBots;
    setBots(freshBots);
    setIdx(0);
    setScore(0);
    setCorrectCount(0);
    setSelected(null);
    setLocked(false);
    setTimeLeft(QUESTION_SECONDS);
    streakRef.current = 0;
    scoreRef.current = 0;
    correctRef.current = 0;
    revealedRef.current = false;
    picksRef.current = [];
    finishedRef.current = false;
    setResult(null);
    setPhase("matching");
  };

  /* Rematch: in demo mode restart locally; in real mode reset the finished
     match on the server (fresh questions, zeroed scores) and start again. */
  const rematch = async () => {
    if (!backend || matchId === null) {
      startMatch();
      return;
    }
    setBusy(true);
    setMatchError("");
    try {
      const reset = await laravelRematch(matchId);
      matchRef.current = reset;
      setMatch(reset);
      lastQuestionIndex.current = -1;
      finishedRefMatch.current = false;
      setResult(null);
      setPickVerdicts({});
      picksRef.current = [];
      setPhase("matching");
      const started = await laravelStartMatch(reset.id);
      if (started.status === "playing") {
        matchRef.current = started;
        setMatch(started);
        lastQuestionIndex.current = started.questionIndex;
        setPhase("playing");
      }
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : "شروع دوباره ناموفق بود");
      setPhase("lobby");
    } finally {
      setBusy(false);
    }
  };

  const reveal = (sel: number | null) => {
    if (revealedRef.current || !current) return;
    revealedRef.current = true;
    setSelected(sel);
    setLocked(true);
    picksRef.current[idx] = sel;
    if (sel !== null && sel === current.correct) {
      const bonus = Math.min(10, streakRef.current * 2);
      scoreRef.current += POINTS + bonus;
      correctRef.current += 1;
      setScore(scoreRef.current);
      setCorrectCount(correctRef.current);
      streakRef.current += 1;
    } else {
      streakRef.current = 0;
    }
    nextTimer.current = window.setTimeout(() => {
      if (idx + 1 < questions.length) {
        setIdx((i) => i + 1);
        setSelected(null);
        setLocked(false);
        revealedRef.current = false;
      } else {
        finishMatch();
      }
    }, 2400);
  };

  const answer = (i: number) => {
    if (locked || phase !== "playing" || revealedRef.current) return;
    reveal(i);
  };

  const finishMatch = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const rows: Row[] = [
      ...botsRef.current.map((b) => ({
        name: b.name,
        color: b.color,
        score: b.score,
        isUser: false,
      })),
      { name: user?.name || "شما", color: "#3B82F6", score: scoreRef.current, isUser: true },
    ];
    const sorted = [...rows].sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex((r) => r.isUser) + 1;
    setResult({ rows: sorted, rank });
    submitMatch({
      mode,
      rank,
      players: sorted.length,
      score: scoreRef.current,
      correct: correctRef.current,
      total: questions.length,
      won: rank === 1,
    });
    setPhase("result");
  };

  const fmt = (s: number) => `${toFa(Math.floor(s / 60))}:${toFa(String(s % 60).padStart(2, "0"))}`;

  /* ───────────── lobby ───────────── */

  if (phase === "lobby" || phase === "matching") {
    const liveBoard = match ? match.players : [];
    const myJoined = match && liveBoard.some((p) => p.isViewer);
    return (
      <div className="container-x max-w-xl py-14">
        <div className="card overflow-hidden">
          <div className="bg-grid h-2 bg-gradient-to-l from-[#EF4444] to-[#7C3AED]" />
          <div className="space-y-6 p-7 sm:p-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="chip mb-3 border border-[#EF4444]/25 bg-[#EF4444]/10 text-[#FF6B81]">
                  <Swords size={13} /> رقابت زنده
                </span>
                <h1 className="text-2xl font-black">مسابقه کوییز زنده</h1>
                <p className="mt-2 text-sm leading-8 text-muted">
                  {backend
                    ? "مسابقه بین کاربران واقعی آکادمی؛ ایجاد کنید یا به مسابقه در انتظار بپیوندید. امتیاز در سرور محاسبه می‌شود."
                    : `${toFa(QUESTION_COUNT)} سؤال سرعتی مشترک؛ هرکس سریع‌تر و دقیق‌تر پاسخ دهد امتیاز می‌گیرد.`}
                </p>
              </div>
            </div>

            {backend && phase === "matching" && match ? (
              <div className="rounded-xl border border-neon/25 bg-neon/5 p-5 text-center animate-fade-in">
                {myJoined ? (
                  <>
                    <Loader2 size={22} className="mx-auto animate-spin text-neon" />
                    <p className="mt-3 font-bold">
                      {match.status === "waiting" ? "در انتظار رقیب‌ها…" : "مسابقه شروع شد!"}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-muted">
                      {toFa(liveBoard.length)} از {toFa(match.maxPlayers)} بازیکن آماده‌اند
                      {match.hostId === user?.id && match.status === "waiting"
                        ? " — شما میزبان هستید"
                        : ""}
                    </p>
                    <div className="mx-auto mt-4 flex max-w-xs justify-center gap-2">
                      {liveBoard.map((p) => (
                        <div key={p.id} className="flex flex-col items-center gap-1">
                          <Avatar
                            name={p.name}
                            size="sm"
                            color={p.isViewer ? "#3B82F6" : "#57B8FF"}
                          />
                          <span className="text-[10px] text-muted">{p.name.split(" ")[0]}</span>
                        </div>
                      ))}
                    </div>
                    {match.hostId === user?.id &&
                      match.status === "waiting" &&
                      liveBoard.length >= 2 && (
                        <button
                          onClick={() =>
                            void laravelStartMatch(match.id)
                              .then((started) => {
                                setMatch(started);
                                if (started.status === "playing") setPhase("playing");
                              })
                              .catch(() => undefined)
                          }
                          className="btn-primary btn-md mt-5"
                        >
                          <PlayIcon /> شروع مسابقه
                        </button>
                      )}
                  </>
                ) : (
                  <>
                    <Loader2 size={22} className="mx-auto animate-spin text-neon" />
                    <p className="mt-3 font-bold">در حال پیوستن به مسابقه…</p>
                  </>
                )}
              </div>
            ) : (
              <>
                {/* mode selector */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMode("1v1")}
                    className={cls(
                      "flex flex-col items-start gap-1.5 rounded-xl border p-4 text-right transition-all",
                      mode === "1v1"
                        ? "border-neon/60 bg-neon/10 shadow-glow-sm"
                        : "border-line/60 bg-surface2/40 hover:border-neon/30"
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-bold">
                      <UserRound size={16} className="text-sky" /> تک‌به‌تک
                    </span>
                    <span className="text-[11px] leading-5 text-muted">
                      ۱ حریف واقعی • برد و باخت مستقیم
                    </span>
                  </button>
                  <button
                    onClick={() => setMode("ffa")}
                    className={cls(
                      "flex flex-col items-start gap-1.5 rounded-xl border p-4 text-right transition-all",
                      mode === "ffa"
                        ? "border-[#7C3AED]/60 bg-[#7C3AED]/10 shadow-glow-sm"
                        : "border-line/60 bg-surface2/40 hover:border-[#7C3AED]/30"
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-bold">
                      <Users size={16} className="text-[#A78BFA]" /> جمعی ۴ نفره
                    </span>
                    <span className="text-[11px] leading-5 text-muted">
                      ۳ رقیب واقعی • سکوی قهرمانی
                    </span>
                  </button>
                </div>

                {/* how it works */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border border-line/50 bg-surface2/40 px-2 py-3">
                    <p className="text-lg font-black text-sky">{toFa(POINTS)}</p>
                    <p className="text-[10px] text-muted">امتیاز هر سؤال</p>
                  </div>
                  <div className="rounded-lg border border-line/50 bg-surface2/40 px-2 py-3">
                    <p className="text-lg font-black text-[#FF6B81]">{toFa(QUESTION_SECONDS)}</p>
                    <p className="text-[10px] text-muted">ثانیه برای هر سؤال</p>
                  </div>
                  <div className="rounded-lg border border-line/50 bg-surface2/40 px-2 py-3">
                    <p className="text-lg font-black text-warn">+{toFa(rankXp(1))}</p>
                    <p className="text-[10px] text-muted">XP جایزه نفر اول</p>
                  </div>
                </div>

                {matchStats.total > 0 && (
                  <p className="flex items-center justify-center gap-2 text-xs text-muted">
                    <Trophy size={13} className="text-warn" />
                    {toFa(matchStats.total)} مسابقه • {toFa(matchStats.wins)} برد • بهترین مقام:{" "}
                    {toFa(matchStats.best ?? "")}
                  </p>
                )}

                {matchError && (
                  <p
                    className="rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-xs text-danger"
                    role="alert"
                  >
                    {matchError}
                  </p>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => (backend ? void createRealMatch(mode) : startMatch())}
                    disabled={busy}
                    className="btn-primary btn-lg flex-1"
                  >
                    {busy ? (
                      <>
                        <Loader2 size={17} className="animate-spin" /> در حال ساخت…
                      </>
                    ) : (
                      <>
                        <Swords size={18} /> {backend ? "ایجاد مسابقه جدید" : "شروع مسابقه"}
                      </>
                    )}
                  </button>
                  <button onClick={() => navigate("/quiz")} className="btn-secondary btn-lg">
                    بازگشت
                  </button>
                </div>

                {backend && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-muted">
                        <RefreshCw size={12} /> مسابقه‌های در انتظار
                      </p>
                      <span className="text-[10px] text-locked">{toFa(lobby.length)} مورد</span>
                    </div>
                    {lobby.length === 0 ? (
                      <p className="rounded-lg border border-line/50 bg-surface2/30 px-4 py-3 text-center text-xs text-muted">
                        فعلاً مسابقه در انتظاری نیست — اولین نفر باشید!
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {lobby.slice(0, 6).map((row) => (
                          <div
                            key={row.id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-line/50 bg-surface2/40 px-3.5 py-2.5"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={cls(
                                  "grid h-8 w-8 place-items-center rounded-lg text-[#FF6B81]",
                                  row.mode === "1v1" ? "bg-sky/15" : "bg-[#7C3AED]/15"
                                )}
                              >
                                {row.mode === "1v1" ? <UserRound size={15} /> : <Users size={15} />}
                              </span>
                              <div>
                                <p className="text-xs font-bold">
                                  {row.host}{" "}
                                  <span className="font-normal text-locked">
                                    • {row.mode === "1v1" ? "تک‌به‌تک" : "۴ نفره"}
                                  </span>
                                </p>
                                <p className="text-[10px] text-muted">
                                  {toFa(row.players)} از {toFa(row.maxPlayers)} بازیکن
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => void joinRealMatch(row.id)}
                              disabled={busy}
                              className="btn-secondary btn-sm"
                            >
                              پیوستن
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ───────────── playing ───────────── */

  if (phase === "playing" && current) {
    const qIndex = currentIdx;
    const qCount = backend && match ? match.questions.length : questions.length;
    const liveRows: Row[] =
      backend && match
        ? match.players.map((p) => ({
            name: p.name,
            color: p.isViewer ? "#3B82F6" : "#57B8FF",
            score: p.score,
            isUser: p.isViewer,
          }))
        : [
            ...bots.map((b) => ({ name: b.name, color: b.color, score: b.score, isUser: false })),
            userRow,
          ];
    const liveSorted = [...liveRows].sort((a, b) => b.score - a.score);
    const displayTime = backend && match && match.questionEndsAt ? realTimeLeft : timeLeft;
    const liveMatch = backend && match ? match : null;
    const verdict = liveMatch ? pickVerdicts[qIndex] : undefined;
    const correctIdx = current.correct ?? -1;
    return (
      <div className="container-x max-w-3xl py-8 sm:py-10">
        {/* live scoreboard */}
        <div className="card mb-5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-black">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EF4444] opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#EF4444]" />
              </span>
              جدول زنده
              {backend && polling && (
                <span className="text-[10px] font-normal text-locked">• همگام‌سازی…</span>
              )}
            </span>
            <span className="text-[11px] text-muted">
              سؤال {toFa(qIndex + 1)} از {toFa(qCount)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {liveSorted.map((r, i) => (
              <div
                key={r.name + i}
                className={cls(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-2",
                  r.isUser ? "border-neon/50 bg-neon/10" : "border-line/50 bg-surface2/40"
                )}
              >
                <span className="w-4 text-center text-[11px] font-black text-muted">
                  {toFa(i + 1)}
                </span>
                <Avatar name={r.name} size="xs" color={r.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold">
                    {r.isUser ? "شما" : r.name.split(" ")[0]}
                  </p>
                  <p className="text-[10px] font-black text-sky">{toFa(r.score)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* timer bar */}
        <div className="sticky top-16 z-30 -mx-4 mb-5 border-b border-line/50 bg-page/90 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">مسابقه سرعتی</span>
            <span
              className={cls(
                "flex items-center gap-1.5 rounded-md px-3 py-1 font-black",
                displayTime <= 3 ? "bg-danger/15 text-danger" : "bg-surface2 text-sky"
              )}
              dir="ltr"
            >
              <Clock size={14} /> {fmt(displayTime)}
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface2">
            <div
              className={cls(
                "h-full rounded-full transition-all duration-300",
                displayTime <= 3 ? "bg-danger" : "bg-gradient-to-l from-[#EF4444] to-[#7C3AED]"
              )}
              style={{
                width: `${(displayTime / (backend && match ? match.secondsPerQuestion : QUESTION_SECONDS)) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* question */}
        <div className="card p-6 sm:p-8 animate-fade-in" key={qIndex}>
          <p className="mb-6 text-lg font-bold leading-9">{current.text}</p>
          <div className="space-y-3">
            {current.options.map((o, i) => {
              const isCorrect = locked && i === correctIdx;
              const isWrongPick = locked && selected === i && i !== correctIdx;
              return (
                <button
                  key={i}
                  onClick={() => (backend ? void answerReal(i) : answer(i))}
                  disabled={locked || (liveMatch !== null && realTimeLeft <= 0)}
                  className={cls(
                    "flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-right text-sm transition-all",
                    isCorrect
                      ? "border-teal bg-teal/10 text-teal"
                      : isWrongPick
                        ? "border-danger bg-danger/10 text-danger"
                        : locked
                          ? "border-line/40 bg-surface2/30 text-locked"
                          : "border-line/60 bg-surface2/40 text-muted hover:border-neon/40"
                  )}
                >
                  <span
                    className={cls(
                      "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold",
                      isCorrect
                        ? "border-teal bg-teal text-white"
                        : isWrongPick
                          ? "border-danger bg-danger text-white"
                          : "border-line text-locked"
                    )}
                  >
                    {toFa(i + 1)}
                  </span>
                  <span className="leading-7">{o}</span>
                  {isCorrect && <CheckCircle2 size={17} className="mr-auto mt-1 shrink-0" />}
                  {isWrongPick && <XCircle size={17} className="mr-auto mt-1 shrink-0" />}
                </button>
              );
            })}
          </div>

          {locked && (
            <div
              className={cls(
                "mt-5 rounded-lg border p-4 animate-slide-up",
                verdict === "wrong"
                  ? "border-danger/25 bg-danger/5"
                  : verdict === "correct"
                    ? "border-teal/25 bg-teal/5"
                    : "border-sky/25 bg-sky/5"
              )}
            >
              <p
                className={cls(
                  "mb-1 font-bold",
                  verdict === "correct" ? "text-teal" : "text-danger"
                )}
              >
                {backend
                  ? verdict === "correct"
                    ? "پاسخ درست بود!"
                    : verdict === "wrong"
                      ? selected === null
                        ? "زمان تمام شد ⏱️"
                        : "پاسخ اشتباه بود — پاسخ درست پس از پایان مسابقه اعلام می‌شود"
                      : selected === null
                        ? "زمان تمام شد — پاسخ درست پس از پایان مسابقه اعلام می‌شود"
                        : "پاسخ ثبت شد — در انتظار محاسبه سرور…"
                  : selected === current.correct
                    ? "پاسخ درست بود!"
                    : selected === null
                      ? "زمان تمام شد ⏱️"
                      : "پاسخ درست:"}
              </p>
              {backend ? (
                verdict === "wrong" &&
                selected !== null && (
                  <p className="text-sm leading-7 text-muted">
                    گزینه {toFa(selected + 1)}: {current.options[selected]}
                  </p>
                )
              ) : (
                <p className="text-sm leading-7 text-muted">
                  {current.options[correctIdx]}. {current.explanation}
                </p>
              )}
              {backend ? (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-locked">
                  <Zap size={12} className="text-warn" /> منتظر پاسخ سایر بازیکنان — نتیجه با
                  همگام‌سازی سرور به‌روز می‌شود
                </p>
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-locked">
                  <Zap size={12} className="text-warn" /> پاسخ‌های پیاپی درست جایزه زنجیره‌ای دارند
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ───────────── result ───────────── */
  const rank = result?.rank ?? 1;
  const xpGain = rankXp(rank);
  const podium = result?.rows.slice(0, 3) ?? [];
  /* The server reveals correct/explanation/myAnswer once the match finishes. */
  const reviewQuestions: Pick<
    MatchQuestion,
    "text" | "options" | "correct" | "explanation" | "myAnswer"
  >[] = backend && match ? match.questions : questions;
  const reviewPicks: (number | null)[] =
    backend && match
      ? reviewQuestions.map((q) => (q.myAnswer === undefined ? null : q.myAnswer))
      : picksRef.current;
  const shareText = `در مسابقه زنده آکادمی ایلیت مقام ${toFa(rank)} از ${toFa(result?.rows.length ?? 4)} را کسب کردم (${toFa(backend && match ? (match.players.find((p) => p.isViewer)?.correct ?? 0) : correctCount)} پاسخ درست) ⚡`;
  return (
    <div className="container-x max-w-xl py-12">
      <div className="card relative overflow-hidden p-8 text-center sm:p-10">
        <div className="bg-grid absolute inset-0 opacity-50" />
        <div className="absolute -top-20 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-[#7C3AED]/15 blur-[80px]" />
        <div className="relative">
          <span className="chip mb-4 border border-warn/25 bg-warn/10 text-warn">
            <Trophy size={14} /> پایان مسابقه
          </span>

          {/* podium */}
          <div className="mx-auto mb-6 grid max-w-sm grid-cols-3 items-end gap-3">
            {[1, 0, 2].map((pos) => {
              const r = podium[pos];
              if (!r) return <div key={pos} />;
              const heights = ["h-16", "h-24", "h-12"];
              const isUser = r.isUser;
              return (
                <div key={pos} className="flex flex-col items-center gap-1.5">
                  {pos === 0 && <Crown size={20} className="text-warn" />}
                  {pos !== 0 && (
                    <Medal size={18} className={pos === 2 ? "text-[#CD7F32]" : "text-muted"} />
                  )}
                  <Avatar name={r.name} size="sm" color={r.color} />
                  <p className="max-w-full truncate text-[11px] font-bold">
                    {isUser ? "شما" : r.name.split(" ")[0]}
                  </p>
                  <div
                    className={cls(
                      "flex w-full flex-col items-center justify-start rounded-t-lg border border-b-0 px-1 pt-2",
                      heights[pos],
                      isUser ? "border-neon/50 bg-neon/15" : "border-line/40 bg-surface2/50"
                    )}
                  >
                    <span className="text-sm font-black text-sky">{toFa(r.score)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <h2 className="text-2xl font-black">
            {rank === 1
              ? "قهرمان مسابقه!"
              : rank === 2
                ? "مقام دوم عالی بود!"
                : rank === 3
                  ? "مقام سوم — نزدیک بود!"
                  : "در مسابقه بعدی می‌برید"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            مقام {toFa(rank)} از {toFa(result?.rows.length ?? 4)} نفر —{" "}
            {toFa(
              backend && match
                ? (match.players.find((p) => p.isViewer)?.correct ?? 0)
                : correctCount
            )}{" "}
            پاسخ درست از {toFa(backend && match ? match.questions.length : questions.length)}
          </p>

          <div className="mx-auto mt-6 grid max-w-xs grid-cols-3 gap-3">
            <div className="rounded-lg border border-warn/25 bg-warn/5 px-3 py-3">
              <p className="text-xl font-black text-warn">{toFa(rank)}</p>
              <p className="text-[11px] text-muted">مقام</p>
            </div>
            <div className="rounded-lg border border-sky/25 bg-sky/5 px-3 py-3">
              <p className="text-xl font-black text-sky">
                {toFa(
                  backend && match ? (match.players.find((p) => p.isViewer)?.score ?? 0) : score
                )}
              </p>
              <p className="text-[11px] text-muted">امتیاز</p>
            </div>
            <div className="rounded-lg border border-teal/25 bg-teal/5 px-3 py-3">
              <p className="text-xl font-black text-teal">+{toFa(xpGain)}</p>
              <p className="text-[11px] text-muted">XP</p>
            </div>
          </div>

          {/* question review — answer key + explanations are revealed now */}
          <div className="mt-8 space-y-3 text-right">
            <p className="flex items-center justify-center gap-1.5 text-sm font-black">
              <BookOpen size={15} /> مرور سؤال‌ها
            </p>
            {reviewQuestions.map((q, i) => {
              const myPick = reviewPicks[i] ?? null;
              const key = q.correct ?? -1;
              const answered = myPick !== null;
              const wasRight = answered && myPick === key;
              return (
                <div
                  key={i}
                  className={cls(
                    "rounded-lg border p-4",
                    wasRight
                      ? "border-teal/25 bg-teal/5"
                      : answered
                        ? "border-danger/25 bg-danger/5"
                        : "border-line/50 bg-surface2/30"
                  )}
                >
                  <p className="flex items-start gap-2 text-sm font-bold leading-7">
                    <span
                      className={cls(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black text-white",
                        wasRight ? "bg-teal" : "bg-danger"
                      )}
                    >
                      {toFa(i + 1)}
                    </span>
                    {q.text}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-muted">
                    <span className="font-bold text-teal">پاسخ درست:</span> {q.options[key] ?? "—"}
                    {myPick !== null && !wasRight && (
                      <span className="text-danger"> • پاسخ شما: {q.options[myPick]}</span>
                    )}
                    {!answered && <span className="text-warn"> • بی‌پاسخ</span>}
                  </p>
                  {q.explanation && (
                    <p className="mt-1 border-t border-line/40 pt-2 text-xs leading-6 text-muted">
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(shareText);
                setShared(true);
                setTimeout(() => setShared(false), 2000);
              }}
              className="btn-secondary btn-md"
            >
              <Share2 size={15} /> {shared ? "کپی شد" : "اشتراک نتیجه"}
            </button>
            <button onClick={() => void rematch()} disabled={busy} className="btn-primary btn-md">
              <RotateCcw size={15} /> {busy ? "در حال آماده‌سازی…" : "مسابقه دوباره"}
            </button>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-3 border-t border-line/50 pt-6">
            <Link to="/quiz" className="btn-ghost btn-sm">
              <Home size={14} /> همه کوییزها
            </Link>
            <Link to="/dashboard" className="btn-ghost btn-sm">
              <ChevronLeft size={14} /> داشبورد
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return <Swords size={16} />;
}
