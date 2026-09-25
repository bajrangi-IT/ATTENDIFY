import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyAttendancePayload {
  session_id: string;
  classroom_id?: string;
  qr_token: string;
  epoch_window: number;
  device_fingerprint?: string;
  geo_lat?: number;
  geo_lng?: number;
}

// Compute Web Crypto HMAC-SHA256
async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // 1. Authenticate user from JWT
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized access" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: VerifyAttendancePayload = await req.json();

    if (!payload.session_id || !payload.qr_token || payload.epoch_window === undefined) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch student profile and record ID
    const { data: profile, error: profileErr } = await supabaseClient
      .from("profiles")
      .select("id, institution_id, role")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile || profile.role !== "student") {
      return new Response(
        JSON.stringify({ error: "Only verified students can submit attendance records" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: student, error: studentErr } = await supabaseClient
      .from("students")
      .select("id, current_section_id")
      .eq("profile_id", profile.id)
      .single();

    if (studentErr || !student) {
      return new Response(JSON.stringify({ error: "Student record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch session details
    const { data: session, error: sessionErr } = await supabaseClient
      .from("attendance_sessions")
      .select("id, classroom_id, section_id, status, secret_seed, start_time, is_attendance_locked")
      .eq("id", payload.session_id)
      .single();

    if (sessionErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.status !== "in_progress") {
      return new Response(
        JSON.stringify({ error: `Session is currently ${session.status}. Check-ins only accepted when in progress.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (session.is_attendance_locked) {
      return new Response(
        JSON.stringify({ error: "Attendance for this session has been locked by faculty." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Verify student is assigned to this session's section
    if (student.current_section_id !== session.section_id) {
      return new Response(
        JSON.stringify({ error: "You are not enrolled in the section for this session." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Verify dynamic QR cryptographic token
    const expectedMessage = `${session.id}:${session.classroom_id}:${payload.epoch_window}`;
    const expectedToken = await hmacSha256(expectedMessage, session.secret_seed);

    if (payload.qr_token !== expectedToken) {
      return new Response(
        JSON.stringify({
          error: "Invalid or expired dynamic QR token. Please scan the live classroom display.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check epoch window drift (15s rotation window, max 1 window drift)
    const currentWindow = Math.floor(Date.now() / 15000);
    if (Math.abs(currentWindow - payload.epoch_window) > 1) {
      return new Response(
        JSON.stringify({ error: "QR code has expired. Please rescan the live display." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Insert canonical attendance record using service role for atomic write
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: record, error: insertError } = await serviceClient
      .from("attendance_records")
      .insert({
        session_id: session.id,
        student_id: student.id,
        status: "present",
        verification_method: "dynamic_qr",
        marked_at: new Date().toISOString(),
        is_finalized: true,
        device_fingerprint: payload.device_fingerprint,
        geo_lat: payload.geo_lat,
        geo_lng: payload.geo_lng,
      })
      .select()
      .single();

    if (insertError) {
      // If code is 23505 (unique violation), the student already checked in
      if (insertError.code === "23505") {
        return new Response(
          JSON.stringify({
            success: true,
            status: "already_marked",
            message: "Attendance has already been recorded for this session.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: "present",
        message: "Attendance recorded successfully!",
        record_id: record.id,
        marked_at: record.marked_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
