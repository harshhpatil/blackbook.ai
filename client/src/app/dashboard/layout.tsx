"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Download,
  History,
  Settings,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Plus,
  LogOut,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { NotificationsPopover } from "@/components/notifications-popover";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: FolderOpen, label: "Projects", href: "/dashboard/projects" },
  { icon: FileText, label: "Templates", href: "/dashboard/templates" },
  { icon: Download, label: "Exports", href: "/dashboard/exports" },
  { icon: History, label: "History", href: "/dashboard/history" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
  { icon: CreditCard, label: "Billing", href: "/dashboard/billing" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, credits, logout } = useAuth();

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex h-screen bg-[#0A0A0A]">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-[#222] bg-[#111] transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-[#222] px-4">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                <span className="text-sm font-bold text-black">B</span>
              </div>
              <span className="text-sm font-semibold text-white">BlackBook AI</span>
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
                <span className="text-sm font-bold text-black">B</span>
              </div>
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-lg p-1.5 text-white/40 hover:text-white transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {sidebarItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="border-t border-[#222] p-3">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <Avatar className="h-8 w-8">
              {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
              <AvatarFallback className="bg-[#222] text-xs text-white">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name || "Guest User"}</p>
                <p className="text-xs text-white/40 truncate">{user?.email || "Not signed in"}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-[#222] bg-[#0A0A0A] px-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/projects/new">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {/* Credit Balance Badge */}
            <Link href="/dashboard/billing">
              <Badge
                variant="outline"
                className="flex items-center gap-1.5 border-[#333] bg-[#161616] px-3 py-1.5 text-xs text-white hover:border-blue-500/50 transition-colors"
              >
                <Zap className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                <span>{credits} Credits</span>
              </Badge>
            </Link>

            {/* Notifications Popover */}
            <NotificationsPopover />

            {/* Logout button */}
            <Button variant="ghost" size="sm" onClick={() => logout()} className="text-white/70 hover:text-white">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
