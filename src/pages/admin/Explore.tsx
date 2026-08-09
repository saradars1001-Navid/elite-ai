import { useState } from "react";
import { Pencil, PlaySquare, Plus, Save, Trash2 } from "lucide-react";
import { AdminHeader, Badge } from "./AdminUI";
import { Modal } from "../../components/ui";
import { useApp } from "../../lib/store";
import { toFa, uid } from "../../lib/utils";
import type { ShortVideo } from "../../lib/types";

const empty = (): ShortVideo => ({
  id: uid("sv"),
  title: "",
  creator: "",
  creatorRole: "مدرس هوش مصنوعی",
  category: "پرامپت‌نویسی",
  description: "",
  videoUrl: "/demo-lesson.mp4",
  durationSeconds: 30,
  tags: [],
  views: 0,
  likes: 0,
  createdAt: new Date().toISOString(),
  status: "draft",
  featured: false,
});

export default function AdminExplore() {
  const { shortVideos, saveShortVideo, deleteShortVideo } = useApp();
  const [editor, setEditor] = useState<ShortVideo | null>(null);
  return (
    <div>
      <AdminHeader
        title="ویدئوهای کوتاه"
        desc="انتشار و مدیریت فید اکسپلور اپلیکیشن"
        action={
          <button onClick={() => setEditor(empty())} className="btn-primary btn-md">
            <Plus size={15} /> ویدئوی جدید
          </button>
        }
      />
      <div className="mb-5 card flex items-center gap-3 border-neon/20 bg-neon/5 p-4 text-sm text-muted">
        <PlaySquare className="text-neon" size={20} /> برای انتشار واقعی، فایل ویدئو را در Storage
        خصوصی Supabase آپلود کنید و لینک امن/مسیر فایل را در فرم ثبت کنید.
      </div>
      <div className="space-y-3">
        {shortVideos.map((v) => (
          <div key={v.id} className="card flex flex-wrap items-center gap-4 p-4">
            <div className="grid h-14 w-14 place-items-center rounded-lg bg-navy text-2xl">▶️</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold">{v.title || "بدون عنوان"}</h2>
                <Badge
                  tone={
                    v.status === "published" ? "success" : v.status === "draft" ? "warn" : "default"
                  }
                >
                  {v.status === "published"
                    ? "منتشرشده"
                    : v.status === "draft"
                      ? "پیش‌نویس"
                      : "آرشیو"}
                </Badge>
                {v.featured && <Badge tone="info">ویژه</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted">
                {v.creator} · {v.category} · {toFa(v.views)} بازدید · {toFa(v.likes)} پسند
              </p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditor(v)} className="btn-ghost btn-sm !px-2 text-sky">
                <Pencil size={14} />
              </button>
              <button
                onClick={() => deleteShortVideo(v.id)}
                className="btn-ghost btn-sm !px-2 text-danger"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={editor ? "ویرایش ویدئوی کوتاه" : ""}
        wide
      >
        {editor && (
          <VideoForm
            value={editor}
            onChange={setEditor}
            onSave={() => {
              if (editor.title.trim() && editor.videoUrl.trim()) {
                saveShortVideo(editor);
                setEditor(null);
              }
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function VideoForm({
  value,
  onChange,
  onSave,
}: {
  value: ShortVideo;
  onChange: (v: ShortVideo) => void;
  onSave: () => void;
}) {
  const patch = (p: Partial<ShortVideo>) => onChange({ ...value, ...p });
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
          <label className="label">دسته‌بندی</label>
          <input
            className="input"
            value={value.category}
            onChange={(e) => patch({ category: e.target.value })}
            placeholder="تولید تصویر"
          />
        </div>
        <div>
          <label className="label">سازنده</label>
          <input
            className="input"
            value={value.creator}
            onChange={(e) => patch({ creator: e.target.value })}
          />
        </div>
        <div>
          <label className="label">نقش سازنده</label>
          <input
            className="input"
            value={value.creatorRole}
            onChange={(e) => patch({ creatorRole: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="label">آدرس ویدئو / مسیر Storage</label>
        <input
          dir="ltr"
          className="input"
          value={value.videoUrl}
          onChange={(e) => patch({ videoUrl: e.target.value })}
          placeholder="/demo-lesson.mp4 یا signed URL"
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
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">مدت (ثانیه)</label>
          <input
            type="number"
            className="input"
            value={value.durationSeconds}
            onChange={(e) => patch({ durationSeconds: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="label">وضعیت</label>
          <select
            className="input"
            value={value.status}
            onChange={(e) => patch({ status: e.target.value as ShortVideo["status"] })}
          >
            <option value="draft">پیش‌نویس</option>
            <option value="published">منتشرشده</option>
            <option value="archived">آرشیو</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pt-8 text-sm">
          <input
            type="checkbox"
            checked={value.featured}
            onChange={(e) => patch({ featured: e.target.checked })}
          />{" "}
          نمایش ویژه
        </label>
      </div>
      <div>
        <label className="label">تگ‌ها (با کاما جدا کنید)</label>
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
      <button onClick={onSave} disabled={!value.title.trim()} className="btn-primary btn-md w-full">
        <Save size={15} /> ذخیره و انتشار
      </button>
    </div>
  );
}
