"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMyClient } from "@/hooks/use-my-client";
import { type ProjectWithClient, useProjects } from "@/hooks/use-projects";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/types/database";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Filter,
  FolderOpen,
  LayoutGrid,
  List,
  MoreVertical,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useSyncExternalStore, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { ClientPortal } from "./client-portal";

const newProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  client_id: z.string().min(1, "Select a client"),
});

type NewProjectForm = z.infer<typeof newProjectSchema>;

function useClients() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["clients"],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as Client[];
    },
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { data: user } = useUser();
  const { data: myClient, isLoading: myClientLoading } = useMyClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [openNew, setOpenNew] = useState(false);
  const [clientFilterId, setClientFilterId] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<ProjectWithClient | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const { data: projects = [], isLoading } = useProjects({
    search: debouncedSearch,
    clientId: clientFilterId,
  });
  const { data: clients = [] } = useClients();

  const showLoadingSkeleton = !mounted || isLoading;

  const form = useForm<NewProjectForm>({
    resolver: zodResolver(newProjectSchema),
    defaultValues: { name: "", client_id: "" },
  });
  const clientIdValue = useWatch({
    control: form.control,
    name: "client_id",
    defaultValue: "",
  });

  async function onCreateProject(data: NewProjectForm) {
    if (!user) return;
    const { error } = await supabase.from("projects").insert({
      user_id: user.id,
      client_id: data.client_id,
      name: data.name,
    });
    if (error) {
      form.setError("root", { message: error.message });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    setOpenNew(false);
    form.reset();
  }

  async function confirmDeleteProject() {
    if (!projectToDelete) return;
    setDeletingProjectId(projectToDelete.id);
    const { error } = await supabase.from("projects").delete().eq("id", projectToDelete.id);
    setDeletingProjectId(null);
    setProjectToDelete(null);
    if (!error) {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
    }
  }

  if (myClientLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-5 w-2/3 rounded bg-muted" />
                <div className="h-4 w-1/2 rounded bg-muted" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (myClient) {
    return <ClientPortal client={myClient} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search for a project"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={clientFilterId ? "secondary" : "outline"}
                size="icon"
                className="shrink-0"
                title="Filter by client"
              >
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[12rem]">
              <DropdownMenuItem onClick={() => setClientFilterId(null)}>
                {!clientFilterId ? "✓ " : ""}
                All clients
              </DropdownMenuItem>
              {clients.map((client) => (
                <DropdownMenuItem key={client.id} onClick={() => setClientFilterId(client.id)}>
                  {clientFilterId === client.id ? "✓ " : ""}
                  {client.name}
                </DropdownMenuItem>
              ))}
              {clients.length === 0 && <DropdownMenuItem disabled>No clients yet</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-r-none"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="rounded-l-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button
            className="shrink-0 bg-[#3ECF8E] hover:bg-[#2EB67D]"
            onClick={() => setOpenNew(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            New project
          </Button>
        </div>
      </div>

      {showLoadingSkeleton ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-5 w-2/3 rounded bg-muted" />
                <div className="h-4 w-1/2 rounded bg-muted" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => router.push(`/dashboard/${project.id}`)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">{project.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {project.clients?.name ?? "—"} • {project.clients?.email ?? ""}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => router.push(`/dashboard/${project.id}`)}>
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Open
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(project);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete project
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  <span className="inline-flex items-center rounded-full bg-[#3ECF8E]/20 px-2 py-0.5 text-xs font-medium text-[#2EB67D]">
                    ACTIVE
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">PROJECT</th>
                  <th className="px-4 py-3 text-left font-medium">CLIENT</th>
                  <th className="px-4 py-3 text-left font-medium">CREATED</th>
                  <th className="w-10 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr
                    key={project.id}
                    tabIndex={0}
                    className="cursor-pointer border-b transition-colors hover:bg-muted/30"
                    onClick={() => router.push(`/dashboard/${project.id}`)}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") &&
                      router.push(`/dashboard/${project.id}`)
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{project.name}</div>
                      <div className="text-xs text-muted-foreground">{project.id.slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {project.clients?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(project.created_at).toLocaleDateString()}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/${project.id}`)}>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Open
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(project);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog
        open={!!projectToDelete}
        onOpenChange={(open) => {
          if (!open) setProjectToDelete(null);
        }}
      >
        <DialogContent
          title="Delete project?"
          description={
            projectToDelete
              ? `"${projectToDelete.name}" and all of its data will be permanently deleted. This includes all tasks, time entries, and invoices. This action cannot be undone.`
              : ""
          }
        >
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setProjectToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteProject}
              disabled={!!deletingProjectId}
            >
              {deletingProjectId ? "Deleting…" : "Delete project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent
          title="New project"
          description="Create a new project and link it to a client."
        >
          <form onSubmit={form.handleSubmit(onCreateProject)} className="space-y-4">
            {form.formState.errors.root && (
              <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
            )}
            <div className="space-y-2">
              <Label>Project name</Label>
              <Input placeholder="My project" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={clientIdValue} onValueChange={(v) => form.setValue("client_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.client_id &&
                React.createElement(
                  "p",
                  { className: "text-sm text-destructive" },
                  form.formState.errors.client_id.message
                )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenNew(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#3ECF8E] hover:bg-[#2EB67D]">
                Create project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
