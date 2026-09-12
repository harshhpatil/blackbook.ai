"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload, Download, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { BRANCHES } from "@/lib/constants";

export default function SettingsPage() {
  const { user, refetchUser, logout } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [collegeName, setCollegeName] = useState("");
  const [branch, setBranch] = useState("");
  const [guideName, setGuideName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setCollegeName(user.collegeName || "");
      setBranch(user.branch || "");
      setGuideName(user.guideName || "");
    }
  }, [user]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.user.updateProfile({
        name,
        collegeName,
        branch,
        guideName,
      });
      await refetchUser();
      toast.success("Profile updated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      await api.user.uploadAvatar(formData);
      await refetchUser();
      toast.success("Avatar updated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleExportData() {
    try {
      const res = await api.user.exportData();
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `blackbook-user-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Account data exported successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to export data");
    }
  }

  async function handleDeleteAccount() {
    if (!confirm("CRITICAL WARNING: Are you sure you want to permanently delete your account? This action cannot be undone.")) return;

    try {
      await api.user.deleteAccount();
      toast.success("Account deleted");
      await logout();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete account");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
        <p className="mt-1 text-sm text-white/40">
          Manage your personal profile, institute details, and privacy.
        </p>
      </div>

      {/* Avatar Card */}
      <Card className="border-[#222] bg-[#111]">
        <CardHeader>
          <CardTitle className="text-white text-base">Profile Picture</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <Avatar className="h-16 w-16">
            {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
            <AvatarFallback className="bg-[#222] text-lg text-white font-semibold">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" className="gap-2 pointer-events-none" asChild>
                <span>
                  {uploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Change Avatar
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploadingAvatar}
              />
            </label>
            <p className="text-xs text-white/40 mt-1">PNG, JPG or WebP. Max 5MB.</p>
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card className="border-[#222] bg-[#111]">
        <CardHeader>
          <CardTitle className="text-white text-base">Personal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/80">Full Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-[#161616]"
                  placeholder="Your full name"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">Email Address</Label>
                <Input
                  value={user?.email || ""}
                  disabled
                  className="bg-[#161616] text-white/40 cursor-not-allowed"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label className="text-white/80">College / Institute Name</Label>
                <Input
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  className="bg-[#161616]"
                  placeholder="e.g. Government Polytechnic Mumbai"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">Branch / Department</Label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full h-9 rounded-md border border-[#222] bg-[#161616] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select branch</option>
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">Project Guide Name</Label>
                <Input
                  value={guideName}
                  onChange={(e) => setGuideName(e.target.value)}
                  className="bg-[#161616]"
                  placeholder="Guide full name"
                />
              </div>
            </div>

            <Button type="submit" disabled={saving} className="gap-2 mt-4">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Actions / Privacy */}
      <Card className="border-[#222] bg-[#111]">
        <CardHeader>
          <CardTitle className="text-white text-base">Data & Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-[#222]">
            <div>
              <p className="text-sm font-medium text-white">Export Account Data</p>
              <p className="text-xs text-white/40">Download a JSON copy of your profile and project history.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportData} className="gap-2">
              <Download className="h-4 w-4" /> Export Data
            </Button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-red-400">Delete Account</p>
              <p className="text-xs text-white/40">Permanently remove your account and all associated projects.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={handleDeleteAccount} className="gap-2">
              <Trash2 className="h-4 w-4" /> Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
