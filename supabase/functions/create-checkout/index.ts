import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// LEGACY: payments are handled by the Laravel backend (see the note in
// payment-webhook/index.ts). This creates Supabase-side pending orders only and
// does not talk to a payment gateway; keep it off in production alongside Laravel.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization || !serviceKey) return json({ error: "unauthorized" }, 401);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, serviceKey);
    const body = (await req.json().catch(() => ({}))) as {
      chapterId?: string;
      couponCode?: string;
    };
    if (!body.chapterId) return json({ error: "chapter_id_required" }, 400);

    const { data: chapter, error: chapterError } = await admin
      .from("chapters")
      .select("id, index, title, price, free")
      .eq("id", body.chapterId)
      .single();
    if (chapterError || !chapter) return json({ error: "chapter_not_found" }, 404);
    if (chapter.free || chapter.price <= 0) return json({ error: "chapter_is_free" }, 400);

    const { data: existing } = await admin
      .from("purchases")
      .select("id, status, receipt_id")
      .eq("user_id", user.id)
      .eq("chapter_id", chapter.id)
      .in("status", ["موفق", "در انتظار"])
      .limit(1)
      .maybeSingle();
    if (existing) return json({ error: "already_purchased", purchase: existing }, 409);

    let discountPercent = 0;
    let discountLabel = "";
    const { data: rules } = await admin
      .from("discount_rules")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    const { data: previous } = await admin
      .from("chapters")
      .select("id")
      .eq("index", chapter.index - 1)
      .maybeSingle();
    if (previous && rules) {
      const { data: previousExam } = await admin
        .from("exams")
        .select("id")
        .eq("chapter_id", previous.id)
        .maybeSingle();
      if (previousExam) {
        const { data: attempts } = await admin
          .from("exam_attempts")
          .select("score, passed")
          .eq("user_id", user.id)
          .eq("exam_id", previousExam.id)
          .eq("passed", true)
          .order("score", { ascending: false })
          .limit(1);
        const score = attempts?.[0]?.score ?? 0;
        if (score >= rules.high_min) {
          discountPercent = rules.high_percent;
          discountLabel = `٪${discountPercent} عملکردی`;
        } else if (score >= rules.mid_min) {
          discountPercent = rules.mid_percent;
          discountLabel = `٪${discountPercent} عملکردی`;
        } else if (score >= rules.low_min) {
          discountPercent = rules.low_percent;
          discountLabel = `٪${discountPercent} عملکردی`;
        }
      }
    }

    const code = body.couponCode?.trim().toUpperCase();
    if (code) {
      const { data: coupon } = await admin
        .from("coupons")
        .select("code, percent, expires_at, max_uses, used_count")
        .eq("code", code)
        .eq("active", true)
        .maybeSingle();
      const valid =
        coupon &&
        (!coupon.expires_at || new Date(coupon.expires_at) > new Date()) &&
        (coupon.max_uses === null || coupon.used_count < coupon.max_uses);
      if (valid) {
        discountPercent = Math.min(100, discountPercent + coupon.percent);
        discountLabel = [discountLabel, `٪${coupon.percent} کد ${code}`]
          .filter(Boolean)
          .join(" + ");
      }
    }

    const amount = Math.max(
      0,
      Math.round((chapter.price * (100 - Math.min(100, discountPercent))) / 100)
    );
    const receiptId = `REC-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    const { data: purchase, error: insertError } = await admin
      .from("purchases")
      .insert({
        user_id: user.id,
        chapter_id: chapter.id,
        price: amount,
        base_price: chapter.price,
        discount_label: discountLabel,
        receipt_id: receiptId,
        status: "در انتظار",
      })
      .select("id, chapter_id, price, base_price, discount_label, receipt_id, status, created_at")
      .single();
    if (insertError || !purchase) return json({ error: "purchase_create_failed" }, 500);

    return json({
      purchase,
      amount,
      status: "در انتظار",
      checkoutUrl: null,
      message: "سفارش ایجاد شد؛ آن را به درگاه پرداخت متصل کنید.",
    });
  } catch (error) {
    console.error("create-checkout", error);
    return json({ error: "internal" }, 500);
  }
});
