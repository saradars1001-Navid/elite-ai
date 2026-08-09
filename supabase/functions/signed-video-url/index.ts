// ─────────────────────────────────────────────────────────────────────────────
//  Elite AI Academy — Edge Function: signed-video-url
//
//  برای هر درخواست پخش ویدئو:
//    ۱) توکن JWT کاربر بررسی می‌شود (هرگز به کلاینت اعتماد نمی‌کنیم)
//    ۲) دسترسی به فصل از دیتابیس (purchases / access_grants / free) چک می‌شود
//    ۳) در صورت مجاز بودن، لینک زمان‌دار (۶۰ دقیقه) برای bucket خصوصی «videos»
//       صادر می‌شود
//
//  استقرار (Supabase CLI):
//    supabase functions deploy signed-video-url
//
//  فراخوانی از کلاینت:
//    supabase.functions.invoke("signed-video-url", { body: { lessonId } })
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SIGNED_URL_TTL_SECONDS = 3600; // ۱ ساعت

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function isAdmin(client: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data } = await client.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ۱) بررسی توکن
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return json({ error: "unauthorized" }, 401);
    }

    // ۲) درس درخواستی
    const body = await req.json().catch(() => ({}));
    const lessonId = (body as { lessonId?: string }).lessonId;
    if (!lessonId) return json({ error: "missing lesson_id" }, 400);

    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .select("id, video_path, free, chapter_id, chapters(free)")
      .eq("id", lessonId)
      .single();

    if (lessonError || !lesson) {
      return json({ error: "not_found" }, 404);
    }

    // ۳) کنترل دسترسی — از دیتابیس، نه از کلاینت
    const chapterFree = (lesson.chapters as { free?: boolean } | null)?.free ?? false;
    const admin = await isAdmin(supabase, user.id);
    const { data: access } = await supabase.rpc("has_chapter_access", {
      p_user_id: user.id,
      p_chapter_id: lesson.chapter_id,
    });

    const allowed = lesson.free || chapterFree || admin || access === true;
    if (!allowed) {
      return json({ error: "forbidden" }, 403);
    }

    if (!lesson.video_path) {
      return json({ error: "no_video" }, 404);
    }

    // ۴) لینک زمان‌دار
    const { data: signed, error: signError } = await supabase.storage
      .from("videos")
      .createSignedUrl(lesson.video_path, SIGNED_URL_TTL_SECONDS);

    if (signError || !signed?.signedUrl) {
      return json({ error: "sign_failed" }, 500);
    }

    return json({
      url: signed.signedUrl,
      expiresIn: SIGNED_URL_TTL_SECONDS,
      expiresAt: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    });
  } catch (err) {
    console.error("signed-video-url:", err);
    return json({ error: "internal" }, 500);
  }
});
