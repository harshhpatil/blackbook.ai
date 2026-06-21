"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-white/40">
          Manage your account settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-white">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input placeholder="Your name" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input placeholder="your@email.com" type="email" />
          </div>
          <div className="space-y-2">
            <Label>College</Label>
            <Input placeholder="Your college name" />
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-white">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Template</Label>
            <Input placeholder="Blackbook" />
          </div>
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Input placeholder="PDF" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
