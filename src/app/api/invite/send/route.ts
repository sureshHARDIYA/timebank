import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { clientId?: string };
    const { clientId } = body;
    if (!clientId) {
      return NextResponse.json({ error: "clientId required" }, { status: 400 });
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, name, email, user_id")
      .eq("id", clientId)
      .single();

    if (clientError || !client || (client as { user_id: string }).user_id !== user.id) {
      return NextResponse.json({ error: "Client not found or access denied" }, { status: 404 });
    }

    const c = client as { id: string; name: string; email: string };
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const { error: insertError } = await supabase.from("client_invites").insert({
      client_id: c.id,
      email: c.email,
      token,
      expires_at: expiresAt.toISOString(),
    });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message ?? "Failed to create invite" },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.headers.get("origin") ?? "";
    const acceptUrl = `${baseUrl}/invite/accept?token=${token}`;

    let emailSent = false;
    let emailError: string | null = null;

    if (process.env.RESEND_API_KEY) {
      const { error: sendError } = await resend.emails.send({
        from: process.env.RESEND_FROM ?? "Tracker <onboarding@resend.dev>",
        to: c.email,
        subject: "Access your projects – sign in or create your account",
        text: `Hi,\n\nYou've been given access to your project board and time entries.\n\nUse the link below to sign in or create an account. You'll then be able to:\n• View all projects shared with you\n• See time entries and activity\n\nOpen this link to log in or get access (valid for 7 days):\n${acceptUrl}\n\nIf you already have an account, sign in with your email. If not, you can create one in one step.\n\nSee you on the board!`,
      });
      if (sendError) {
        emailError = sendError.message ?? "Email failed to send";
        console.error("Resend invite email error:", sendError);
      } else {
        emailSent = true;
      }
    }

    const message = emailSent
      ? "Invite sent by email."
      : emailError
        ? `Invite created but email failed: ${emailError}. Copy the link below and send it to the client.`
        : "Invite created. Copy the link below and send it to the client (RESEND_API_KEY not set).";

    return NextResponse.json({
      success: true,
      acceptUrl,
      emailSent,
      emailError: emailError ?? undefined,
      message,
    });
  } catch (e) {
    console.error("invite/send:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
