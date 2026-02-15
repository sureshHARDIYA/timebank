"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import type { Client } from "@/types/database";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, FileText, Mail, MoreVertical, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  hourly_rate_usd: z.coerce.number().min(0, "Must be ≥ 0"),
});

type ClientForm = z.infer<typeof clientSchema>;

function useClients(search?: string) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["clients", search],
    queryFn: async () => {
      let q = supabase.from("clients").select("*").order("name");
      if (search?.trim()) {
        q = q.or(`name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as Client[];
    },
  });
}

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);
  const [clientToInvite, setClientToInvite] = useState<Client | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    acceptUrl?: string;
    message?: string;
    emailSent?: boolean;
  } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const { data: user } = useUser();
  const { data: clients = [], isLoading } = useClients(search);

  const { data: projectsForClient = [] } = useQuery({
    queryKey: ["projects-for-client", clientToDelete?.id],
    enabled: !!clientToDelete?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id")
        .eq("client_id", clientToDelete!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: "", email: "", hourly_rate_usd: 0 },
  });

  async function onSubmit(data: ClientForm) {
    if (!user) return;
    if (editing) {
      const { error } = await supabase
        .from("clients")
        .update({
          name: data.name,
          email: data.email,
          hourly_rate_usd: data.hourly_rate_usd,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);
      if (error) {
        form.setError("root", { message: error.message });
        return;
      }
    } else {
      const { error } = await supabase.from("clients").insert({
        user_id: user.id,
        name: data.name,
        email: data.email,
        hourly_rate_usd: data.hourly_rate_usd,
      });
      if (error) {
        form.setError("root", { message: error.message });
        return;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["clients"] });
    setOpen(false);
    setEditing(null);
    form.reset({ name: "", email: "", hourly_rate_usd: 0 });
  }

  function openEdit(client: Client) {
    setEditing(client);
    form.reset({
      name: client.name,
      email: client.email,
      hourly_rate_usd: client.hourly_rate_usd,
    });
    setOpen(true);
  }

  function openNew() {
    setEditing(null);
    form.reset({ name: "", email: "", hourly_rate_usd: 0 });
    setOpen(true);
  }

  async function confirmDeleteClient() {
    if (!clientToDelete || projectsForClient.length > 0) return;
    setDeletingClientId(clientToDelete.id);
    const { error } = await supabase.from("clients").delete().eq("id", clientToDelete.id);
    setDeletingClientId(null);
    setClientToDelete(null);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    }
  }

  async function sendInvite() {
    if (!clientToInvite) return;
    setSendingInvite(true);
    setInviteResult(null);
    try {
      const res = await fetch("/api/invite/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientToInvite.id }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        acceptUrl?: string;
        message?: string;
        error?: string;
        emailSent?: boolean;
      };
      if (!res.ok) {
        setInviteResult({ message: data.error ?? "Failed to send invite" });
        setSendingInvite(false);
        return;
      }
      setInviteResult({
        acceptUrl: data.acceptUrl,
        message: data.message ?? "Invite sent.",
        emailSent: data.emailSent,
      });
      setLinkCopied(false);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    } catch (e) {
      setInviteResult({
        message: e instanceof Error ? e.message : "Failed to send invite",
      });
    } finally {
      setSendingInvite(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button className="bg-[#3ECF8E] hover:bg-[#2EB67D]" onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          New client
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">NAME</th>
                <th className="px-4 py-3 text-left font-medium">EMAIL</th>
                <th className="px-4 py-3 text-left font-medium">HOURLY RATE (USD)</th>
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{client.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{client.email}</td>
                    <td className="px-4 py-3">{formatCurrency(client.hourly_rate_usd)}</td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/reports?client=${client.id}`}>
                              <FileText className="mr-2 h-4 w-4" />
                              View report
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(client)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setClientToInvite(client);
                              setInviteResult(null);
                            }}
                            disabled={!!(client as { invited_user_id?: string }).invited_user_id}
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            {(client as { invited_user_id?: string }).invited_user_id
                              ? "Already invited"
                              : "Invite client"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setClientToDelete(client)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete client
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog
        open={!!clientToInvite}
        onOpenChange={(open) => {
          if (!open) {
            setClientToInvite(null);
            setInviteResult(null);
          }
        }}
      >
        <DialogContent
          title="Invite client"
          description={
            clientToInvite
              ? (clientToInvite as { invited_user_id?: string }).invited_user_id
                ? "This client has already been invited and can log in to view their projects."
                : `Send an invite to ${clientToInvite.email}? They will receive a link to sign up or sign in and view their projects and time entries.`
              : ""
          }
        >
          {clientToInvite && (clientToInvite as { invited_user_id?: string }).invited_user_id && (
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setClientToInvite(null)}>
                Close
              </Button>
            </DialogFooter>
          )}
          {clientToInvite && !(clientToInvite as { invited_user_id?: string }).invited_user_id && (
            <>
              {inviteResult?.message && (
                <p
                  className={`text-sm ${
                    inviteResult.emailSent === false && inviteResult.acceptUrl
                      ? "text-amber-600 dark:text-amber-500"
                      : inviteResult.acceptUrl
                        ? "text-foreground"
                        : "text-destructive"
                  }`}
                >
                  {inviteResult.message}
                </p>
              )}
              {inviteResult?.acceptUrl && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md bg-muted p-2 text-xs break-all">
                    {inviteResult.acceptUrl}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteResult.acceptUrl!);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 2000);
                      } catch {
                        setLinkCopied(false);
                      }
                    }}
                  >
                    {linkCopied ? (
                      "Copied!"
                    ) : (
                      <>
                        <Copy className="mr-1 h-3.5 w-3.5" />
                        Copy link
                      </>
                    )}
                  </Button>
                </div>
              )}
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setClientToInvite(null)}>
                  {inviteResult ? "Close" : "Cancel"}
                </Button>
                {!inviteResult && (
                  <Button
                    className="bg-[#3ECF8E] hover:bg-[#2EB67D]"
                    onClick={sendInvite}
                    disabled={sendingInvite}
                  >
                    {sendingInvite ? "Sending…" : "Send invite"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!clientToDelete}
        onOpenChange={(open) => {
          if (!open) setClientToDelete(null);
        }}
      >
        <DialogContent
          title={
            clientToDelete && projectsForClient.length > 0
              ? "Cannot delete client"
              : "Delete client?"
          }
          description={
            clientToDelete
              ? projectsForClient.length > 0
                ? `"${clientToDelete.name}" has ${projectsForClient.length} project(s). Delete all projects for this client first from the Projects page, then you can delete the client.`
                : `Remove "${clientToDelete.name}" from your clients? This action cannot be undone.`
              : ""
          }
        >
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setClientToDelete(null)}>
              {projectsForClient.length > 0 ? "OK" : "Cancel"}
            </Button>
            {projectsForClient.length > 0 ? (
              <Button asChild className="bg-[#3ECF8E] hover:bg-[#2EB67D]">
                <Link href="/dashboard">Go to projects</Link>
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={confirmDeleteClient}
                disabled={!!deletingClientId}
              >
                {deletingClientId ? "Deleting…" : "Delete client"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit client" : "New client"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update client details and hourly rate."
                : "Add a client and set their hourly rate in USD."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="Acme Inc" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="billing@acme.com" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Hourly rate (USD)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                {...form.register("hourly_rate_usd")}
              />
              {form.formState.errors.hourly_rate_usd && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.hourly_rate_usd.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#3ECF8E] hover:bg-[#2EB67D]">
                {editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
