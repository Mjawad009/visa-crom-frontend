"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { Branch, BranchCreatePayload } from "@/lib/types/branch";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function NewBranchContent() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", code: "", address: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: BranchCreatePayload = {
        name: form.name,
        code: form.code,
        address: form.address || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
      };
      const branch = await authedApiClient.post<Branch>("/branches/", payload);
      router.push(`/dashboard/branches/${branch.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create branch.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="New branch">
      <Card className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 py-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input required value={form.name} onChange={(e) => update("name", e.target.value)} />
              </div>
              <div>
                <Label>Code</Label>
                <Input
                  required
                  placeholder="e.g. TOR-01"
                  value={form.code}
                  onChange={(e) => update("code", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => update("address", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
              </div>
            </div>

            {error && <p className="text-sm text-signal-rejected">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create branch"}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </AppShell>
  );
}

export default function NewBranchPage() {
  return (
    <ProtectedRoute>
      <NewBranchContent />
    </ProtectedRoute>
  );
}
