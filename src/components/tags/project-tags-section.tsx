"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Tag } from "lucide-react";
import Link from "next/link";

export function ProjectTagsSection() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Tag className="h-4 w-4" />
          Tags
        </CardTitle>
        <Link
          href="/tags"
          className="inline-flex items-center gap-1 text-sm font-medium text-[#3ECF8E] hover:text-[#2EB67D]"
        >
          Manage tags
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Tags are global. Create tags in the Tags page, then assign them when logging time (manual
          entry or timer).
        </p>
      </CardContent>
    </Card>
  );
}
