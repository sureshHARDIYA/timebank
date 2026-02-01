"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, MoreVertical, Search, FileText } from "lucide-react";
import Link from "next/link";
import type { Client } from "@/types/database";
import { formatCurrency } from "@/lib/utils";

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

  const { data: clients = [], isLoading } = useClients(search);

  const form = useForm<ClientForm>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: "", email: "", hourly_rate_usd: 0 },
  });

  async function onSubmit(data: ClientForm) {
    const { data: { user } } = await supabase.auth.getUser();
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
                            Edit
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit client" : "New client"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update client details and hourly rate." : "Add a client and set their hourly rate in USD."}
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
                <p className="text-sm text-destructive">{form.formState.errors.hourly_rate_usd.message}</p>
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
