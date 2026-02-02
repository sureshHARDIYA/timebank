import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM ?? "Tracker <onboarding@resend.dev>";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      invoiceId?: string;
      projectId?: string;
      to?: string[];
    };
    const { invoiceId, projectId, to } = body;
    if (!invoiceId || !projectId || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json(
        { error: "Missing invoiceId, projectId, or to addresses" },
        { status: 400 }
      );
    }

    const validTo = to.filter((e) => typeof e === "string" && e.includes("@"));
    if (validTo.length === 0) {
      return NextResponse.json({ error: "No valid email addresses" }, { status: 400 });
    }

    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("project_id", projectId)
      .single();
    if (invError || !invoice) {
      return NextResponse.json({ error: "Invoice not found or access denied" }, { status: 404 });
    }

    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("*, clients(*)")
      .eq("id", projectId)
      .single();
    if (projError || !project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    const projectName = (project as { name?: string }).name ?? "Project";
    const subject = `Invoice: ${projectName} (${invoice.period_start} – ${invoice.period_end})`;
    const textBody = [
      `Project: ${projectName}`,
      `Period: ${invoice.period_start} to ${invoice.period_end}`,
      `Total time: ${formatDuration(Math.round(invoice.total_minutes))}`,
      `Total amount: ${formatCurrency(invoice.amount_usd)}`,
      "",
      "Thank you.",
    ].join("\n");

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          error:
            "Email sending is not configured. Set RESEND_API_KEY in your environment. Get a key at https://resend.com/api-keys",
        },
        { status: 503 }
      );
    }

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: validTo,
      subject,
      text: textBody,
    });

    if (error) {
      return NextResponse.json({ error: error.message ?? "Failed to send email" }, { status: 502 });
    }

    const now = new Date().toISOString();
    await supabase
      .from("invoices")
      .update({
        is_sent: true,
        sent_at: now,
        updated_at: now,
      })
      .eq("id", invoiceId);

    return NextResponse.json({ success: true, id: data?.id });
  } catch (e) {
    console.error("send-invoice-email:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
