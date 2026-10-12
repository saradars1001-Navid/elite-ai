import { useState } from "react";
import { Flag, Trash2, Lock as LockIcon, Unlock, Users, MessageSquare } from "lucide-react";
import { useApp } from "../../lib/store";
import { AdminHeader, Table, Td, TRow, Badge } from "./AdminUI";
import { toFa, timeAgo } from "../../lib/utils";
import { Modal } from "../../components/ui";

export default function AdminCommunity() {
  const {
    state,
    communityPosts,
    communityComments,
    deletePost,
    setPostStatus,
    deleteComment,
    clearReport,
  } = useApp();
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const reportedIds = Object.entries(state.reportCounts)
    .filter(([, c]) => c > 0)
    .map(([id]) => id);

  const reported = communityPosts.filter((p) => reportedIds.includes(p.id));
  const normal = communityPosts.filter((p) => !reportedIds.includes(p.id));
  const postComments = (postId: string) => communityComments.filter((c) => c.postId === postId);

  return (
    <div>
      <AdminHeader
        title="مدیریت کامیونیتی"
        desc="بررسی محتوای گزارش‌شده، حذف، بستن بحث و مدیریت پاسخ‌ها"
      />

      {saved && (
        <div className="card mb-6 border border-teal/25 p-4 text-sm text-teal animate-fade-in">
          تغییرات ذخیره شد.
        </div>
      )}

      {/* reported */}
      <h2 className="mb-3 flex items-center gap-2 font-bold">
        <Flag size={17} className="text-danger" /> محتوای گزارش‌شده ({toFa(reported.length)})
      </h2>
      {reported.length === 0 ? (
        <div className="card mb-8 flex items-center gap-3 p-6 text-sm text-muted">
          <Flag size={18} className="text-teal" /> هیچ محتوای گزارش‌شده‌ای وجود ندارد.
        </div>
      ) : (
        <div className="mb-8 space-y-3">
          {reported.map((p) => (
            <div key={p.id} className="card border border-danger/25 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="danger">گزارش‌شده</Badge>
                    <span className="text-xs text-muted">
                      توسط {toFa(state.reportCounts[p.id])} کاربر
                    </span>
                  </div>
                  <p className="mt-2 font-bold">{p.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{p.body}</p>
                  <p className="mt-1 text-[11px] text-locked">
                    {p.author.name} • {p.category} • {timeAgo(p.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    onClick={() => {
                      clearReport(p.id);
                      flash();
                    }}
                    className="btn-secondary btn-sm"
                  >
                    <Flag size={14} /> بستن گزارش
                  </button>
                  <button
                    onClick={() => {
                      setPostStatus(p.id, p.status === "closed" ? "open" : "closed");
                      flash();
                    }}
                    className="btn-secondary btn-sm"
                  >
                    {p.status === "closed" ? <Unlock size={14} /> : <LockIcon size={14} />}
                    {p.status === "closed" ? "بازکردن بحث" : "بستن بحث"}
                  </button>
                  <button onClick={() => setConfirmDel(p.id)} className="btn-danger btn-sm">
                    <Trash2 size={14} /> حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* all posts */}
      <h2 className="mb-3 flex items-center gap-2 font-bold">
        <Users size={17} className="text-sky" /> همه پست‌ها ({toFa(communityPosts.length)})
      </h2>
      <Table head={["عنوان", "نویسنده", "دسته‌بندی", "لایک", "پاسخ", "وضعیت", "اقدامات"]}>
        {normal.map((p) => (
          <TRow key={p.id}>
            <Td>
              <p className="max-w-[260px] truncate font-bold">{p.title}</p>
            </Td>
            <Td className="text-xs text-muted">{p.author.name}</Td>
            <Td className="text-xs">{p.category}</Td>
            <Td>{toFa(p.likes + (state.postLikes[p.id] || 0))}</Td>
            <Td>{toFa(p.commentsCount)}</Td>
            <Td>
              <Badge tone={p.status === "closed" ? "warn" : "success"}>
                {p.status === "closed" ? "بسته" : "باز"}
              </Badge>
            </Td>
            <Td>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCommentsOpen(p.id)}
                  className="btn-ghost btn-sm !px-2 text-sky"
                  title="مدیریت پاسخ‌ها"
                >
                  <MessageSquare size={14} />
                </button>
                <button
                  onClick={() => {
                    setPostStatus(p.id, p.status === "closed" ? "open" : "closed");
                    flash();
                  }}
                  className="btn-ghost btn-sm !px-2 text-warn"
                  title="بستن/بازکردن بحث"
                >
                  {p.status === "closed" ? <Unlock size={14} /> : <LockIcon size={14} />}
                </button>
                <button
                  onClick={() => setConfirmDel(p.id)}
                  className="btn-ghost btn-sm !px-2 text-danger"
                  title="حذف"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Td>
          </TRow>
        ))}
      </Table>

      {/* delete confirm */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="حذف پست">
        <div className="space-y-4">
          <p className="text-sm leading-7 text-muted">
            این پست به‌همراه تمام پاسخ‌هایش به‌صورت دائمی حذف می‌شود. مطمئن هستید؟
          </p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDel(null)} className="btn-secondary btn-md flex-1">
              انصراف
            </button>
            <button
              onClick={() => {
                deletePost(confirmDel!);
                setConfirmDel(null);
                flash();
              }}
              className="btn-danger btn-md flex-1"
            >
              <Trash2 size={15} /> حذف پست
            </button>
          </div>
        </div>
      </Modal>

      {/* comments manager */}
      <Modal
        open={!!commentsOpen}
        onClose={() => setCommentsOpen(null)}
        title="مدیریت پاسخ‌ها"
        wide
      >
        <div className="space-y-2.5">
          {postComments(commentsOpen || "").length === 0 && (
            <div className="rounded-lg border border-dashed border-line/60 p-6 text-center text-sm text-muted">
              پاسخی برای این پست ثبت نشده است.
            </div>
          )}
          {postComments(commentsOpen || "").map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-line/50 bg-surface2/40 p-3.5"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold text-sky">
                  {c.author.name}{" "}
                  <span className="font-normal text-locked">• {timeAgo(c.createdAt)}</span>
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">{c.body}</p>
              </div>
              <button
                onClick={() => {
                  deleteComment(c.id);
                  flash();
                }}
                className="btn-ghost btn-sm shrink-0 !px-2 text-danger"
                aria-label="حذف پاسخ"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
