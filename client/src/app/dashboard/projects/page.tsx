"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, FolderOpen, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Project {
  id: number;
  name: string;
  type: string;
  status: string;
  branch: string | null;
  semester: string | null;
  createdAt: string;
}

const statusColors: Record<string, "default" | "primary" | "secondary" | "success" | "warning" | "destructive"> = {
  draft: "secondary",
  uploading: "warning",
  extracting: "warning",
  analyzing: "primary",
  planning: "primary",
  generating: "primary",
  validating: "primary",
  completed: "success",
  failed: "destructive",
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects?limit=50");
      const json = await res.json();
      setProjects(json.data || []);
    } catch (error) {
      console.error("Failed to fetch projects", error);
    } finally {
      setLoading(false);
    }
  }

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
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
              : "Create your first project to get started."}
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
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Link href={`/dashboard/projects/${project.id}`}>
                <Card className="cursor-pointer transition-all hover:border-white/20 hover:bg-[#161616] h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base text-white">
                        {project.name}
                      </CardTitle>
                      <Badge
                        variant={statusColors[project.status] || "default"}
                      >
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      {project.type && (
                        <span className="rounded-full border border-[#222] px-2 py-0.5 capitalize">
                          {project.type}
                        </span>
                      )}
                      {project.branch && (
                        <span className="rounded-full border border-[#222] px-2 py-0.5">
                          {project.branch}
                        </span>
                      )}
                      {project.semester && (
                        <span className="rounded-full border border-[#222] px-2 py-0.5">
                          Sem {project.semester}
                        </span>
                      )}
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
