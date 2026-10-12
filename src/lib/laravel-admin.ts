import { laravelToken } from "./laravel";
import type { RefundRequest } from "./types";

const baseUrl = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export interface AdminPaymentEvent {
  id: string | number;
  source: "webhook" | "callback";
  gateway: string | null;
  type: "payment" | "refund";
  referenceType: string | null;
  referenceId: string | null;
  status: "received" | "processed" | "idempotent" | "ignored" | "failed";
  payload: Record<string, unknown> | null;
  verifyResult: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
}

export interface AdminPricingPreview {
  chapter: { id: string; title: string; index: number; free: boolean };
  basePrice: number;
  performanceEligible: boolean;
  performancePercent: number;
  couponPercent: number;
  couponValid: boolean;
  couponMessage: string | null;
  totalPercent: number;
  finalPrice: number;
  discountLabel: string;
  tiers: { label: string; min: number; percent: number }[];
}

export interface AdminStats {
  sales: {
    revenue: number;
    baseRevenue: number;
    orders: number;
    paidOrders: number;
    pendingOrders: number;
    failedOrders: number;
    refundedOrders: number;
    avgOrder: number;
    daily: { date: string; count: number; total: number }[];
    recent: {
      id: string | number;
      receiptId: string;
      chapterTitle: string;
      userName: string;
      price: number;
      status: string;
      createdAt: string;
    }[];
  };
  progress: {
    users: number;
    activeUsers: number;
    newUsers30d: number;
    completedLessons: number;
    distinctLearners: number;
    avgXp: number;
    streakHolders: number;
    perChapter: {
      id: string;
      index: number;
      title: string;
      icon: string | null;
      free: boolean;
      learners: number;
      completionRate: number;
    }[];
    topLearners: { id: string; name: string; xp: number; streak: number }[];
  };
  quizzes: {
    attempts: number;
    avgScore: number;
    passRate: number;
    perQuiz: {
      id: string;
      title: string;
      kind: string;
      difficulty: string;
      attempts: number;
      avgScore: number;
      bestScore: number;
    }[];
    daily: { date: string; count: number }[];
    topScorers: { name: string; score: number; total: number; pct: number }[];
  };
}
export async function laravelAdminSave(
  resource: string,
  payload: Record<string, unknown>
): Promise<void> {
  const response = await fetch(`${baseUrl}/admin/resources/${resource}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${laravelToken() || ""}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("ذخیره در API لاراول ناموفق بود");
}
/** Recent payment webhook/callback events from the audit log (admin-only). */
export async function laravelAdminPaymentEvents(): Promise<AdminPaymentEvent[]> {
  const response = await fetch(`${baseUrl}/admin/payment-events`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${laravelToken() || ""}` },
  });
  if (!response.ok) throw new Error("دریافت رویدادهای پرداخت ناموفق بود");
  const data = (await response.json()) as { events: AdminPaymentEvent[] };
  return data.events || [];
}

/** Real dashboard statistics from the Laravel API (admin-only). */
export async function laravelAdminStats(): Promise<AdminStats> {
  const response = await fetch(`${baseUrl}/admin/stats`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${laravelToken() || ""}` },
  });
  if (!response.ok) throw new Error("دریافت آمار از API لاراول ناموفق بود");
  return (await response.json()) as AdminStats;
}

/** Simulate the final chapter price for a hypothetical score + coupon (admin-only). */
export async function laravelAdminPricingPreview(payload: {
  chapterId: string;
  examScore?: number | null;
  couponCode?: string | null;
}): Promise<AdminPricingPreview> {
  const response = await fetch(`${baseUrl}/admin/pricing/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${laravelToken() || ""}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("محاسبه قیمت ناموفق بود");
  return (await response.json()) as AdminPricingPreview;
}

export async function laravelAdminDelete(resource: string, id: string): Promise<void> {
  const response = await fetch(`${baseUrl}/admin/resources/${resource}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Accept: "application/json", Authorization: `Bearer ${laravelToken() || ""}` },
  });
  if (!response.ok) throw new Error("حذف از API لاراول ناموفق بود");
}

/* ─────────────────────── broadcast notifications (admin) ─────────────────────── */

/**
 * Send a public/group announcement. The Laravel backend creates one in-app
 * notification row per active non-admin user scoped by the audience and
 * returns the real recipient count.
 */
export async function laravelAdminSendNotification(payload: {
  type: string;
  title: string;
  body: string;
  link?: string;
  audience: "all" | "chapter-buyers" | "active-30d" | "no-purchase";
  chapterId?: string;
}): Promise<{ recipients: number }> {
  const response = await fetch(`${baseUrl}/admin/notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${laravelToken() || ""}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message || "ارسال اعلان ناموفق بود");
  }
  const data = (await response.json()) as { recipients: number };
  return { recipients: Number(data.recipients || 0) };
}

/* ─────────────────────── refund requests (admin) ─────────────────────── */

export interface AdminRefundRequest {
  id: string;
  chapterId: string;
  chapterTitle: string;
  userName: string;
  userPhone: string;
  price: number;
  receiptId: string;
  status: string;
  refundStatus: RefundRequest["refundStatus"];
  refundReason: string;
  refundRequestedAt?: string;
  refundedAt?: string;
  refundRejectedAt?: string;
  createdAt: string;
}

/** List purchases that carry a user refund request (pending or done). */
export async function laravelAdminRefundRequests(
  status: "pending" | "done" = "pending"
): Promise<AdminRefundRequest[]> {
  const response = await fetch(`${baseUrl}/admin/refunds?status=${status}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${laravelToken() || ""}` },
  });
  if (!response.ok) throw new Error("دریافت درخواست‌های بازگشت وجه ناموفق بود");
  const data = (await response.json()) as { items: AdminRefundRequest[] };
  return data.items || [];
}

/** Admin approves a pending refund request (refunds at the gateway). */
export async function laravelAdminRefundApprove(
  purchaseId: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(
    `${baseUrl}/admin/refunds/${encodeURIComponent(purchaseId)}/approve`,
    {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${laravelToken() || ""}` },
    }
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return { ok: false, error: body.message || "تأیید بازگشت وجه ناموفق بود" };
  }
  return { ok: true };
}

/** Admin rejects a pending refund request and keeps the purchase paid. */
export async function laravelAdminRefundReject(
  purchaseId: string,
  reason?: string
): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(
    `${baseUrl}/admin/refunds/${encodeURIComponent(purchaseId)}/reject`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${laravelToken() || ""}`,
      },
      body: JSON.stringify({ reason }),
    }
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return { ok: false, error: body.message || "رد درخواست بازگشت وجه ناموفق بود" };
  }
  return { ok: true };
}
