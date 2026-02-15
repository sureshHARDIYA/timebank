import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token")?.trim();
    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_client_invite_by_token", {
      invite_token: token,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to load invite" },
        { status: 400 }
      );
    }

    const rows = (data ?? []) as {
      client_id: string;
      client_name: string;
      email: string;
      expires_at: string;
      accepted_at: string | null;
    }[];
    if (rows.length === 0) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
    }

    const row = rows[0];
    if (row.accepted_at) {
      return NextResponse.json({ error: "Invite already accepted" }, { status: 400 });
    }
    if (new Date(row.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 400 });
    }

    return NextResponse.json({
      clientName: row.client_name,
      email: row.email,
      expiresAt: row.expires_at,
    });
  } catch (e) {
    console.error("invite GET:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
