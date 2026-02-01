"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDuration } from "@/lib/utils";
import type { Client, Invoice, TimeEntry } from "@/types/database";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { ArrowLeft, Check, FileDown, Mail, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function useProject(id: string | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["project", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, clients(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

function useTimeEntries(projectId: string | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["time-entries", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("project_id", projectId!)
        .not("end_time", "is", null)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as TimeEntry[];
    },
  });
}

function useInvoices(projectId: string | null) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["invoices", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("project_id", projectId!)
        .order("period_end", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
  });
}

function useTimeEntryTags(entryIds: string[]) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["time-entry-tags", entryIds.join(",")],
    enabled: entryIds.length > 0,
    queryFn: async () => {
      const { data: links, error: e1 } = await supabase
        .from("time_entry_tags")
        .select("time_entry_id, tag_id")
        .in("time_entry_id", entryIds);
      if (e1 || !links?.length)
        return {
          links: [] as { time_entry_id: string; tag_id: string }[],
          tags: [] as { id: string; name: string; color: string }[],
        };
      const tagIds = Array.from(new Set(links.map((l) => l.tag_id)));
      const { data: tags, error: e2 } = await supabase
        .from("tags")
        .select("id, name, color")
        .in("id", tagIds);
      if (e2) return { links: links as { time_entry_id: string; tag_id: string }[], tags: [] };
      return {
        links: links as { time_entry_id: string; tag_id: string }[],
        tags: (tags ?? []) as { id: string; name: string; color: string }[],
      };
    },
  });
}

const defaultRangeEnd = new Date();
const defaultRangeStart = subDays(defaultRangeEnd, 29);

export default function ProjectReportPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { data: user } = useUser();

  const [rangeStart, setRangeStart] = useState(() =>
    format(startOfDay(defaultRangeStart), "yyyy-MM-dd")
  );
  const [rangeEnd, setRangeEnd] = useState(() => format(startOfDay(defaultRangeEnd), "yyyy-MM-dd"));
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("report");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  const { data: project, isLoading } = useProject(id);
  const { data: entries = [] } = useTimeEntries(id);
  const { data: invoices = [], isLoading: invoicesLoading } = useInvoices(id);
  const entryIds = entries.map((e) => e.id);
  const { data: tagData } = useTimeEntryTags(entryIds);
  const { links: entryTagLinks = [], tags: tagMeta = [] } = tagData ?? {};

  const rangeStartDate = useMemo(() => startOfDay(new Date(rangeStart)), [rangeStart]);
  const rangeEndDate = useMemo(() => endOfDay(new Date(rangeEnd)), [rangeEnd]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (!e.end_time) return false;
      const start = new Date(e.start_time).getTime();
      const end = new Date(e.end_time).getTime();
      return start <= rangeEndDate.getTime() && end >= rangeStartDate.getTime();
    });
  }, [entries, rangeStartDate, rangeEndDate]);

  const totalMinutes = useMemo(() => {
    return filteredEntries.reduce((acc, e) => {
      if (!e.end_time) return acc;
      const start = new Date(e.start_time).getTime();
      const end = new Date(e.end_time).getTime();
      return acc + (end - start) / (60 * 1000);
    }, 0);
  }, [filteredEntries]);

  const client = project?.clients as Client | undefined;
  const hourlyRate = client?.hourly_rate_usd ?? 0;
  const totalBill = (totalMinutes / 60) * hourlyRate;

  const byDay: Record<string, number> = useMemo(() => {
    const out: Record<string, number> = {};
    const start = startOfDay(rangeStartDate);
    const end = startOfDay(rangeEndDate);
    if (end.getTime() >= start.getTime()) {
      const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      for (let i = 0; i < days; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        out[format(d, "yyyy-MM-dd")] = 0;
      }
    }
    for (const e of filteredEntries) {
      if (!e.end_time) continue;
      const es = new Date(e.start_time);
      const ee = new Date(e.end_time);
      const key = format(startOfDay(es), "yyyy-MM-dd");
      if (key in out) {
        out[key] += (ee.getTime() - es.getTime()) / (60 * 1000);
      }
    }
    return out;
  }, [filteredEntries, rangeStartDate, rangeEndDate]);
  const chartData = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, minutes]) => ({
      date: format(new Date(date), "MMM d"),
      minutes: Math.round(minutes),
      hours: (minutes / 60).toFixed(1),
    }));

  const byTask: Record<string, number> = {};
  for (const e of filteredEntries) {
    if (!e.end_time) continue;
    const name = e.task_name || "Other";
    const start = new Date(e.start_time).getTime();
    const end = new Date(e.end_time).getTime();
    byTask[name] = (byTask[name] ?? 0) + (end - start) / (60 * 1000);
  }
  const taskChartData = Object.entries(byTask)
    .map(([name, minutes]) => ({ name, minutes: Math.round(minutes) }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10);

  const byTag: Record<string, number> = {};
  const tagById = Object.fromEntries(tagMeta.map((t) => [t.id, t]));
  for (const e of filteredEntries) {
    if (!e.end_time) continue;
    const start = new Date(e.start_time).getTime();
    const end = new Date(e.end_time).getTime();
    const mins = (end - start) / (60 * 1000);
    const tagsOnEntry = entryTagLinks
      .filter((l) => l.time_entry_id === e.id)
      .map((l) => tagById[l.tag_id]?.name ?? "—");
    if (tagsOnEntry.length === 0) {
      byTag.Untagged = (byTag.Untagged ?? 0) + mins;
    } else {
      for (const name of tagsOnEntry) {
        byTag[name] = (byTag[name] ?? 0) + mins;
      }
    }
  }
  const tagChartData = Object.entries(byTag)
    .map(([name, minutes]) => ({ name, minutes: Math.round(minutes) }))
    .sort((a, b) => b.minutes - a.minutes);

  async function handleGenerateInvoice() {
    if (!user || !project) return;
    setGenerating(true);
    const { error } = await supabase.from("invoices").insert({
      project_id: id,
      user_id: user.id,
      period_start: rangeStart,
      period_end: rangeEnd,
      total_minutes: Math.round(totalMinutes * 100) / 100,
      amount_usd: Math.round(totalBill * 100) / 100,
    });
    setGenerating(false);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["invoices", id] });
      setActiveTab("invoices");
    }
  }

  async function toggleSent(invoice: Invoice) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("invoices")
      .update({
        is_sent: !invoice.is_sent,
        sent_at: invoice.is_sent ? null : now,
        updated_at: now,
      })
      .eq("id", invoice.id);
    if (!error) queryClient.invalidateQueries({ queryKey: ["invoices", id] });
  }

  async function togglePaid(invoice: Invoice) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("invoices")
      .update({
        is_paid: !invoice.is_paid,
        paid_at: invoice.is_paid ? null : now,
        updated_at: now,
      })
      .eq("id", invoice.id);
    if (!error) queryClient.invalidateQueries({ queryKey: ["invoices", id] });
  }

  function handleEmailForInvoice(inv: Invoice) {
    const subject = encodeURIComponent(
      `Invoice: ${project?.name ?? "Project"} (${inv.period_start} – ${inv.period_end})`
    );
    const body = encodeURIComponent(
      `Project: ${project?.name}\nPeriod: ${inv.period_start} to ${inv.period_end}\nTotal time: ${formatDuration(Math.round(inv.total_minutes))}\nTotal amount: ${formatCurrency(inv.amount_usd)}\n\nThank you.`
    );
    const url = `mailto:${client?.email ?? ""}?subject=${subject}&body=${body}`;
    const link = document.createElement("a");
    link.href = url;
    link.click();
  }

  function handleDownloadForInvoice(inv: Invoice) {
    const url = `/dashboard/${id}/report/print?start=${inv.period_start}&end=${inv.period_end}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function confirmDeleteInvoice() {
    if (!invoiceToDelete) return;
    const inv = invoiceToDelete;
    setInvoiceToDelete(null);
    setDeletingId(inv.id);
    const { error } = await supabase.from("invoices").delete().eq("id", inv.id);
    setDeletingId(null);
    if (!error) queryClient.invalidateQueries({ queryKey: ["invoices", id] });
  }

  if (isLoading || !project) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-muted" />
          <div className="h-64 rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to project
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Report: {project.name}</h1>
        <p className="text-muted-foreground">
          {client?.name} • {client?.email}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="report" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Total time</CardTitle>
                <p className="text-3xl font-semibold text-[#3ECF8E]">
                  {formatDuration(Math.round(totalMinutes))}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rangeStart} – {rangeEnd}
                </p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Amount due</CardTitle>
                <p className="text-3xl font-semibold">
                  {formatCurrency(totalBill)}
                  {hourlyRate > 0 && (
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      @ {formatCurrency(hourlyRate)}/hr
                    </span>
                  )}
                </p>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Time by day ({rangeStart} – {rangeEnd})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}m`} />
                    <Tooltip
                      formatter={(value: number) => [formatDuration(value), "Minutes"]}
                      labelFormatter={(_, payload) => payload[0]?.payload?.date}
                    />
                    <Bar dataKey="minutes" fill="#3ECF8E" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time by task</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={taskChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={(v) => `${v}m`} />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => [formatDuration(value), "Minutes"]} />
                    <Bar dataKey="minutes" fill="#2EB67D" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {tagChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Time by tag</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Overview of time spent per tag for this project.
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={tagChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tickFormatter={(v) => `${v}m`} />
                      <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => [formatDuration(value), "Minutes"]} />
                      <Bar dataKey="minutes" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Duration</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select the date range for the invoice. Then generate an invoice for that period.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="report-start">From</Label>
                <Input
                  id="report-start"
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-end">To</Label>
                <Input
                  id="report-end"
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                />
              </div>
              <Button
                className="bg-[#3ECF8E] hover:bg-[#2EB67D]"
                onClick={handleGenerateInvoice}
                disabled={generating || totalMinutes <= 0}
              >
                <Plus className="mr-2 h-4 w-4" />
                {generating ? "Creating…" : "Generate invoice"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <p className="text-sm text-muted-foreground">
                Generated invoices for this project. Email or download per invoice, then mark when
                sent and when paid.
              </p>
            </CardHeader>
            <CardContent>
              {invoicesLoading ? (
                <p className="text-sm text-muted-foreground">Loading invoices…</p>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No invoices yet. Select a duration above and click &quot;Generate invoice&quot;.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Actions</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          {inv.period_start} – {inv.period_end}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDuration(Math.round(inv.total_minutes))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(inv.amount_usd)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEmailForInvoice(inv)}
                              disabled={!client?.email}
                              title="Email bill to client"
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              className="bg-[#3ECF8E] hover:bg-[#2EB67D]"
                              onClick={() => handleDownloadForInvoice(inv)}
                              title="Download PDF"
                            >
                              <FileDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setInvoiceToDelete(inv)}
                              disabled={deletingId === inv.id}
                              title="Delete invoice"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant={inv.is_sent ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => toggleSent(inv)}
                          >
                            {inv.is_sent ? (
                              <>
                                <Check className="mr-1 h-3 w-3" />
                                Sent
                              </>
                            ) : (
                              "Mark sent"
                            )}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant={inv.is_paid ? "default" : "outline"}
                            size="sm"
                            className={inv.is_paid ? "bg-[#3ECF8E] hover:bg-[#2EB67D]" : ""}
                            onClick={() => togglePaid(inv)}
                          >
                            {inv.is_paid ? (
                              <>
                                <Check className="mr-1 h-3 w-3" />
                                Paid
                              </>
                            ) : (
                              "Mark paid"
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!invoiceToDelete}
        onOpenChange={(open) => {
          if (!open) setInvoiceToDelete(null);
        }}
      >
        <DialogContent
          title="Delete invoice?"
          description={
            invoiceToDelete
              ? `Delete invoice for ${invoiceToDelete.period_start} – ${invoiceToDelete.period_end} (${formatCurrency(invoiceToDelete.amount_usd)})? This cannot be undone.`
              : ""
          }
        >
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setInvoiceToDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteInvoice} disabled={!!deletingId}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
