import { useState } from "react";
import { Trash2, Users as UsersIcon, UserPlus, Pencil, Save } from "lucide-react";
import { AdminHeader, Table, Td, TRow, Badge, faNum } from "./AdminUI";
import { useApp } from "../../lib/store";
import { toFa, uid } from "../../lib/utils";
import { Modal } from "../../components/ui";
import type { ManagedUser } from "../../lib/types";

const ROLE_LABEL: Record<ManagedUser["role"], string> = {
  user: "کاربر",
  admin: "مدیر",
};

export default function AdminUsers() {
  const { user, managedUsers, saveManagedUser, deleteManagedUser } = useApp();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [editor, setEditor] = useState<ManagedUser | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saved, setSaved] = useState(false);

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const openNew = () => {
    setIsNew(true);
    setEditor({
      id: uid("u"),
      name: "",
      phone: "",
      role: "user",
      label: "کاربر",
      color: "#3B82F6",
      joinedAt: "امروز",
      status: "فعال",
      purchases: 0,
    });
  };

  const openEdit = (u: ManagedUser) => {
    setIsNew(false);
    setEditor({ ...u });
  };

  const submit = () => {
    if (!editor || !editor.name.trim()) return;
    saveManagedUser(editor);
    setEditor(null);
    flash();
  };

  return (
    <div>
      <AdminHeader
        title="مدیریت کاربران"
        desc={`${faNum(managedUsers.length)} کاربر ثبت‌شده — افزودن، ویرایش نقش و وضعیت`}
        action={
          <button onClick={openNew} className="btn-primary btn-md">
            <UserPlus size={15} /> افزودن کاربر
          </button>
        }
      />

      {saved && (
        <div className="card mb-6 border border-teal/25 p-4 text-sm text-teal animate-fade-in">
          تغییرات کاربر ذخیره شد.
        </div>
      )}

      <Table
        head={[
          "کاربر",
          "شماره موبایل",
          "نقش",
          "برچسب",
          "تاریخ عضویت",
          "خریدها",
          "وضعیت",
          "اقدامات",
        ]}
      >
        {managedUsers.map((u) => (
          <TRow key={u.id}>
            <Td>
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-9 w-9 place-items-center rounded-full text-xs font-bold text-white"
                  style={{ background: u.color }}
                >
                  {u.name[0]}
                </span>
                <span className="font-bold">{u.name}</span>
              </div>
            </Td>
            <Td className="font-mono text-xs" dir="ltr">
              {toFa(u.phone)}
            </Td>
            <Td>
              <Badge tone={u.role === "admin" ? "warn" : "default"}>{ROLE_LABEL[u.role]}</Badge>
            </Td>
            <Td className="text-xs text-muted">{u.label}</Td>
            <Td className="text-muted">{u.joinedAt}</Td>
            <Td>{toFa(u.purchases)}</Td>
            <Td>
              <Badge tone={u.status === "فعال" ? "success" : "danger"}>{u.status}</Badge>
            </Td>
            <Td>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openEdit(u)}
                  className="btn-ghost btn-sm !px-2 text-sky"
                  title="ویرایش"
                  aria-label={`ویرایش ${u.name}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setConfirm(u.id)}
                  disabled={u.id === user?.id}
                  className="btn-ghost btn-sm !px-2 text-danger disabled:cursor-not-allowed disabled:opacity-40"
                  title={u.id === user?.id ? "نمی‌توانید حساب خود را حذف کنید" : "حذف کاربر"}
                  aria-label={`حذف ${u.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Td>
          </TRow>
        ))}
      </Table>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <UsersIcon size={14} className="text-sky" />
        نقش «مدیر» دسترسی کامل به پنل مدیریت می‌دهد. تغییر نقش کاربر با ورود بعدی او اعمال می‌شود.
      </p>

      {/* delete confirm */}
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="حذف کاربر">
        <div className="space-y-4">
          <p className="text-sm leading-7 text-muted">
            این کاربر به‌همراه دسترسی‌ها و فعالیت‌هایش حذف می‌شود. این عمل قابل بازگشت نیست.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setConfirm(null)} className="btn-secondary btn-md flex-1">
              انصراف
            </button>
            <button
              onClick={() => {
                deleteManagedUser(confirm!);
                setConfirm(null);
                flash();
              }}
              className="btn-danger btn-md flex-1"
            >
              <Trash2 size={15} /> حذف کاربر
            </button>
          </div>
        </div>
      </Modal>

      {/* add / edit user */}
      <Modal
        open={!!editor}
        onClose={() => setEditor(null)}
        title={isNew ? "افزودن کاربر" : "ویرایش کاربر"}
        wide
      >
        {editor && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">نام و نام خانوادگی</label>
                <input
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                  className="input"
                  placeholder="مثلاً: زهرا رستمی"
                />
              </div>
              <div>
                <label className="label">شماره موبایل</label>
                <input
                  value={editor.phone}
                  onChange={(e) => setEditor({ ...editor, phone: e.target.value })}
                  className="input"
                  dir="ltr"
                  placeholder="09123456789"
                />
              </div>
              <div>
                <label className="label">نقش</label>
                <select
                  value={editor.role}
                  onChange={(e) =>
                    setEditor({ ...editor, role: e.target.value as ManagedUser["role"] })
                  }
                  className="input"
                >
                  <option value="user">کاربر</option>
                  <option value="admin">مدیر</option>
                </select>
              </div>
              <div>
                <label className="label">برچسب (مثلاً مدرس، کارآفرین)</label>
                <input
                  value={editor.label}
                  onChange={(e) => setEditor({ ...editor, label: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">وضعیت</label>
                <select
                  value={editor.status}
                  onChange={(e) =>
                    setEditor({ ...editor, status: e.target.value as ManagedUser["status"] })
                  }
                  className="input"
                >
                  <option>فعال</option>
                  <option>غیرفعال</option>
                </select>
              </div>
              <div>
                <label className="label">تاریخ عضویت</label>
                <input
                  value={editor.joinedAt}
                  onChange={(e) => setEditor({ ...editor, joinedAt: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            <button
              onClick={submit}
              disabled={!editor.name.trim()}
              className="btn-primary btn-md w-full"
            >
              <Save size={15} /> {isNew ? "ثبت کاربر" : "ذخیره تغییرات"}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
