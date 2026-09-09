"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen,
  FileText,
  Zap,
  Clock,
  ArrowRight,
  Plus,
  Loader2,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";

export default function DashboardPage() {
  const { user, credits } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [assetCount, setAssetCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [projRes, assetRes] = await Promise.all([
          api.projects.getProjects().catch(() => ({ projects: [] })),
          api.assets.getAssets().catch(() => ({ assets: [] })),
        ]);
        setProjects(projRes.projects || []);
        const assetsList = assetRes.assets || assetRes || [];
        setAssetCount(Array.isArray(assetsList) ? assetsList.length : 0);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const stats = [
    {
      label: "Total Projects",
      value: projects.length.toString(),
      icon: FolderOpen,
      change: `${projects.length} project workspace${projects.length === 1 ? "" : "s"}`,
      gradient: "from-blue-500 to-blue-600",
    },
    {
      label: "Documents & Assets",
      value: assetCount.toString(),
      icon: FileText,
      change: `${assetCount} uploaded/generated file${assetCount === 1 ? "" : "s"}`,
      gradient: "from-purple-500 to-purple-600",
    },
    {
      label: "Available Credits",
      value: credits.toString(),
      icon: Zap,
      change: "Active Balance",
      gradient: "from-amber-500 to-amber-600",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
        </h1>
        <p className="mt-1 text-sm text-white/40">
          BlackBook AI Documentation Operating System.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card className="border-[#222] bg-[#111]">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-white/60">
                  {stat.label}
                </CardTitle>
                <div className={`inline-flex rounded-lg bg-gradient-to-br ${stat.gradient} p-2 text-white`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{loading ? "-" : stat.value}</div>
                <p className="mt-1 text-xs text-white/40">{stat.change}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent Projects & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Projects */}
        <Card className="border-[#222] bg-[#111]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-white/40" />
              Recent Projects
            </CardTitle>
            {projects.length > 0 && (
              <Link href="/dashboard/projects">
                <Button variant="ghost" size="sm" className="text-xs text-blue-400">
                  View All
                </Button>
              </Link>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 flex justify-center text-white/30">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="h-12 w-12 text-white/10" />
                <h3 className="mt-4 text-sm font-medium text-white/40">
                  No projects created yet
                </h3>
                <p className="mt-1 text-xs text-white/30">
                  Create your first project workspace to start generating documentation.
                </p>
                <Link href="/dashboard/projects/new" className="mt-4">
                  <Button size="sm" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Project
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#222]">
                {projects.slice(0, 5).map((project) => (
                  <Link
                    key={project._id}
                    href={`/dashboard/projects/${project._id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors">
                        {project.title}
                      </p>
                      <p className="text-[11px] text-white/40 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Updated {new Date(project.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className="capitalize text-[10px]">
                      {project.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-[#222] bg-[#111]">
          <CardHeader>
            <CardTitle className="text-white text-base">Quick Actions</CardTitle>
            <p className="text-xs text-white/40">
              Generate MSBTE blackbooks and technical reports in minutes.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/dashboard/projects/new">
              <Button className="w-full justify-between gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500" size="lg">
                <span>Create New Project</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/dashboard/templates">
                <Button variant="outline" className="w-full text-xs" size="sm">
                  Browse Templates
                </Button>
              </Link>
              <Link href="/dashboard/billing">
                <Button variant="outline" className="w-full text-xs" size="sm">
                  Get More Credits
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
