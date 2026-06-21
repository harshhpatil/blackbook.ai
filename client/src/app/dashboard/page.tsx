"use client";

import { motion } from "framer-motion";
import {
  FolderOpen,
  FileText,
  Download,
  TrendingUp,
  ArrowRight,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const stats = [
  {
    label: "Total Projects",
    value: "0",
    icon: FolderOpen,
    change: "+0 this month",
    gradient: "from-blue-500 to-blue-600",
  },
  {
    label: "Documents Generated",
    value: "0",
    icon: FileText,
    change: "0 this month",
    gradient: "from-purple-500 to-purple-600",
  },
  {
    label: "Exports",
    value: "0",
    icon: Download,
    change: "0 this month",
    gradient: "from-green-500 to-green-600",
  },
  {
    label: "Usage",
    value: "0%",
    icon: TrendingUp,
    change: "Free Plan",
    gradient: "from-orange-500 to-orange-600",
  },
];

const recentProjects = [
  // Empty state - no projects yet
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-white/40">
          Welcome to BlackBook AI. Start a new project to generate documentation.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-white/60">
                  {stat.label}
                </CardTitle>
                <div
                  className={`inline-flex rounded-lg bg-gradient-to-br ${stat.gradient} p-2 text-white`}
                >
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <p className="mt-1 text-xs text-white/40">{stat.change}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Projects */}
        <Card>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-white/40" />
              Recent Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="h-12 w-12 text-white/10" />
                <h3 className="mt-4 text-sm font-medium text-white/40">
                  No projects yet
                </h3>
                <p className="mt-1 text-xs text-white/30">
                  Create your first project to get started.
                </p>
                <Link href="/dashboard/projects/new" className="mt-4">
                  <Button size="sm" className="gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Create Project
                  </Button>
                </Link>
              </div>
            ) : (
              <div>{/* Project list */}</div>
            )}
          </CardContent>
        </Card>

        {/* Quick Start */}
        <Card>
          <CardHeader>
            <CardTitle className="text-white">Quick Start</CardTitle>
            <p className="text-sm text-white/40">
              Generate your first blackbook in minutes.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/dashboard/projects/new">
              <Button className="w-full justify-between gap-2" size="lg">
                <span>Create New Blackbook</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/dashboard/templates">
                <Button variant="outline" className="w-full" size="sm">
                  Browse Templates
                </Button>
              </Link>
              <Link href="/dashboard/exports">
                <Button variant="outline" className="w-full" size="sm">
                  View Exports
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
