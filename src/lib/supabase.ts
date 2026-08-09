import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase integration.
 *
 * When VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in the environment,
 * the app uses real Supabase for:
 *   - phone (SMS) OTP authentication  →  supabase.auth.signInWithOtp / verifyOtp
 *   - authorization checks & purchases → PostgreSQL + Row Level Security
 *   - secure lesson videos             → Edge Function + signed URLs
 *
 * Otherwise the app falls back to the built-in demo mode (localStorage).
 * See SUPABASE_SETUP.md for the step-by-step setup guide.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Human-readable Persian error for common auth failures. */
export function authErrorMessage(err: { code?: string; message?: string } | null): string {
  if (!err) return "خطای ناشناخته";
  const code = err.code || "";
  if (code.includes("otp_expired") || /expired/i.test(err.message || ""))
    return "کد تأیید منقضی شده است. لطفاً کد جدید درخواست کنید.";
  if (code.includes("otp_disabled") || /phone.*provider/i.test(err.message || ""))
    return "ارسال پیامک روی پروژه فعال نشده است. راهنمای SUPABASE_SETUP.md را ببینید.";
  if (code.includes("over_request_rate_limit"))
    return "درخواست‌های زیادی ثبت شد. کمی صبر کنید و دوباره تلاش کنید.";
  if (/invalid.*otp|wrong|incorrect/i.test(err.message || ""))
    return "کد واردشده صحیح نیست. دوباره بررسی کنید.";
  if (/network|fetch|socket/i.test(err.message || ""))
    return "مشکل در ارتباط با سرور. اتصال اینترنت را بررسی کنید.";
  return err.message || "خطا در ارتباط با سرور";
}
