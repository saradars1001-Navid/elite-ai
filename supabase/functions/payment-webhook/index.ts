import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-payment-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type PaymentStatus = "موفق" | "ناموفق" | "لغوشده";

/*
 * LEGACY — disabled by default.
 *
 * Payments are owned by the Laravel backend (backend/app/Http/Controllers/
 * PaymentWebhookController.php), which verifies every notification with the gateway
 * before granting access. This function instead trusts a shared header and sets the
 * purchase to "موفق" without any gateway check, so it must not run next to the
 * Laravel deployment. It only answers when ENABLE_LEGACY_SUPABASE_PAYMENTS=true is
 * set explicitly (e.g. for a Supabase-only demo).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (Deno.env.get("ENABLE_LEGACY_SUPABASE_PAYMENTS") !== "true")
    return json({ error: "legacy_payments_disabled", use: "laravel_payment_webhook" }, 410);
  const secret = Deno.env.get("PAYMENT_WEBHOOK_SECRET") ?? "";
  if (!secret || req.headers.get("x-payment-secret") !== secret)
    return json({ error: "unauthorized" }, 401);

  try {
    const body = (await req.json()) as {
      purchaseId?: string;
      status?: PaymentStatus;
      authority?: string;
    };
    if (!body.purchaseId || !body.status || !["موفق", "ناموفق", "لغوشده"].includes(body.status))
      return json({ error: "invalid_payload" }, 400);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: purchase, error: findError } = await admin
      .from("purchases")
      .select("id, status, user_id, chapter_id, receipt_id")
      .eq("id", body.purchaseId)
      .single();
    if (findError || !purchase) return json({ error: "purchase_not_found" }, 404);
    if (purchase.status === "موفق") return json({ ok: true, purchase, idempotent: true });

    const { data: updated, error: updateError } = await admin
      .from("purchases")
      .update({
        status: body.status,
        receipt_id: body.authority
          ? `${purchase.receipt_id}-${body.authority}`
          : purchase.receipt_id,
      })
      .eq("id", purchase.id)
      .eq("status", "در انتظار")
      .select("id, status, receipt_id")
      .single();
    if (updateError || !updated) return json({ error: "purchase_update_failed" }, 500);
    return json({ ok: true, purchase: updated });
  } catch (error) {
    console.error("payment-webhook", error);
    return json({ error: "internal" }, 500);
  }
});
