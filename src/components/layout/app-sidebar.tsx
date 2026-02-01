"use client";

import { cn } from "@/lib/utils";
import { BarChart3, Calendar, FileText, LayoutDashboard, Settings, Tag, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Projects", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/statistics", label: "Statistics", icon: BarChart3 },
  { href: "/tags", label: "Tags", icon: Tag },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-[#1C1C1C] text-white transition-all duration-200",
        expanded ? "w-52" : "w-[52px]"
      )}
    >
      <div className="flex h-14 items-center border-b border-white/10 px-3">
        {expanded ? (
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Image
              src="/logo.png"
              alt="Time Track"
              width={32}
              height={32}
              className="rounded"
              priority
            />
            <span className="text-sm">Time Track</span>
          </Link>
        ) : (
          <Link href="/dashboard" className="flex justify-center w-full">
            <Image
              src="/logo.png"
              alt="Time Track"
              width={32}
              height={32}
              className="rounded"
              priority
            />
          </Link>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#3ECF8E]/20 text-[#3ECF8E]"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {expanded && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
