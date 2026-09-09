"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, FolderOpen, Search, Trash2, Calendar, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

interface ProjectItem {
  _id: string;
  title: string;
  status: "draft" | "processing" | "completed" | "failed";
  contentData?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

const statusColors: Record<string, "default" | "primary" | "secondary" | "success" | "warning" | "destructive"> = {
  draft: "secondary",
  processing: "warning",
  completed: "success",
  failed: "destructive",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      setLoading(true);
      const res = await api.projects.getProjects();
      setProjects(res.projects || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    if (!confirm("Are you sure you want to delete this project?")) return;

    try {
      await api.projects.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p._id !== id));
      toast.success("Project deleted successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete project");
    }
  }

  const filtered = projects.filter((p) =>
    (p.title || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="mt-1 text-sm text-white/40">
            Manage your documentation projects.
          </p>
        </div>
        <Link href="/dashboard/projects/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Project Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl bg-[#111] border border-[#222]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <FolderOpen className="h-16 w-16 text-white/10" />
          <h3 className="mt-4 text-lg font-medium text-white/40">
            {search ? "No projects found" : "No projects yet"}
          </h3>
          <p className="mt-1 text-sm text-white/30">
            {search
              ? "Try a different search term."
              : "Create your first project workspace to start generating documentation."}
          </p>
          {!search && (
            <Link href="/dashboard/projects/new" className="mt-6">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Project
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project, index) => (
            <motion.div
              key={project._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Link href={`/dashboard/projects/${project._id}`}>
                <Card className="cursor-pointer transition-all hover:border-white/20 hover:bg-[#161616] h-full flex flex-col justify-between group">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                        {project.title}
                      </CardTitle>
                      <Badge variant={statusColors[project.status] || "default"}>
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-white/40">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteProject(project._id, e)}
                        className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
