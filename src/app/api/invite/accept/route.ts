import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();
    if (!token) {
      return NextResponse.json({ error: "token required" }, { status: 400 });
    }

    const { data, error } = await supabase.rpc("accept_client_invite", {
      invite_token: token,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message ?? "Failed to accept invite" },
        { status: 400 }
      );
    }

    const result = data as { success?: boolean; error?: string } | null;
    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error ?? "Invalid or expired invite" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("invite/accept:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
