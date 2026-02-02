"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

type Client = { name?: string | null; email?: string | null };

export function ProjectDetailHeader({
  projectName,
  client,
  projectId,
}: {
  projectName: string;
  client: Client | null | undefined;
  projectId: string;
}) {
  return (
    <>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{projectName}</h1>
          <p className="text-muted-foreground">
            {client?.name} • {client?.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#3ECF8E]/20 px-2 py-1 text-xs font-medium text-[#2EB67D]">
            ACTIVE
          </span>
          <Button asChild className="bg-[#3ECF8E] hover:bg-[#2EB67D]">
            <Link href={`/dashboard/${projectId}/report`}>View report & billing</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
