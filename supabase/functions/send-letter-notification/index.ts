import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const EMAILJS_SERVICE_ID = "service_p5fkbd7";
const EMAILJS_TEMPLATE_ID = "template_q4ucc9c";
const EMAILJS_PUBLIC_KEY = "w8yX3Ti7xYPworE4h";
const SHOP_ORIGIN = "https://fionyannawang-pixel.github.io";
const SHOP_URL = SHOP_ORIGIN + "/the-little-shop/";

async function sendNotification(recipientEmail: string, letterId: string, replyName = "") {
  const letterUrl = SHOP_URL + "?letter=" + encodeURIComponent(letterId) + "#things";
  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: SHOP_ORIGIN },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: recipientEmail,
        name: "Beyond Small Beyond Big Store Official",
        from_name: "Beyond Small Beyond Big Store Official",
        email: recipientEmail,
        letter_url: letterUrl,
        notification_type: replyName ? "reply" : "letter",
        reply_sender_name: replyName,
        reply_notice: replyName ? "你写的信收到了回复" : "",
        message: replyName ? "你写的信收到了回复" : "",
        subject: replyName ? "你写的信收到了回复" : "",
      },
    }),
  });
  const responseText = (await response.text()).trim();
  if (!response.ok) {
    const safeDetail = responseText.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[address]").slice(0, 180);
    throw new Error("EmailJS rejected the notification (HTTP " + response.status + ")" + (safeDetail ? ": " + safeDetail : ""));
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: { "Content-Type": "application/json" } });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return new Response(JSON.stringify({ error: "Notification worker is not configured." }), { status: 503, headers: { "Content-Type": "application/json" } });
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: letters, error: letterClaimError } = await supabase.rpc("claim_due_letter_notifications", { p_limit: 50 });
    if (letterClaimError) throw new Error("Could not claim due letters.");
    const { data: replies, error: replyClaimError } = await supabase.rpc("claim_pending_letter_reply_notifications", { p_limit: 50 });
    if (replyClaimError) throw new Error("Could not claim pending replies.");

    let sent = 0, failed = 0;
    for (const letter of letters ?? []) {
      let status: "sent" | "failed" = "failed";
      let errorMessage = "EmailJS request failed.";
      try {
        await sendNotification(letter.recipient_email, letter.id);
        status = "sent";
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "EmailJS request failed.";
      }
      const { error: updateError } = await supabase.from("letters").update({
        email_status: status,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        email_error: status === "failed" ? errorMessage : null,
      }).eq("id", letter.id).eq("email_status", "sending");
      if (updateError || status === "failed") failed++;
      else sent++;
    }

    for (const reply of replies ?? []) {
      let status: "sent" | "failed" = "failed";
      let errorMessage = "EmailJS request failed.";
      try {
        await sendNotification(reply.recipient_email, reply.letter_id, reply.sender_name || "Someone");
        status = "sent";
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "EmailJS request failed.";
      }
      const { error: updateError } = await supabase.from("letter_replies").update({
        email_status: status,
        sent_at: status === "sent" ? new Date().toISOString() : null,
        email_error: status === "failed" ? errorMessage : null,
      }).eq("id", reply.id).eq("email_status", "sending");
      if (updateError || status === "failed") failed++;
      else sent++;
    }
    return new Response(JSON.stringify({ ok: true, processed: sent + failed, sent, failed }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ error: "Notification run failed." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});