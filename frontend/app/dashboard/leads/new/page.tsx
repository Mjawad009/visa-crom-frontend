"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { LEAD_SOURCES, Lead } from "@/lib/types/lead";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

function NewLeadContent() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    source: "website",
    country_of_interest: "",
    visa_type_interest: "",
    notes: "",
  });
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
      const payload = {
        ...form,
        email: form.email || undefined,
        phone: form.phone || undefined,
        country_of_interest: form.country_of_interest || undefined,
        visa_type_interest: form.visa_type_interest || undefined,
        notes: form.notes || undefined,
      };
      const lead = await authedApiClient.post<Lead>("/leads/", payload);
      router.push(`/dashboard/leads/${lead.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create lead.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="New lead">
      <Card className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 py-5">
            <div>
              <Label>Full name</Label>
              <Input required value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Source</Label>
                <Select value={form.source} onChange={(e) => update("source", e.target.value)}>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Country of interest</Label>
                <Input value={form.country_of_interest} onChange={(e) => update("country_of_interest", e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Visa type of interest</Label>
              <Input
                placeholder="e.g. Study visa, Skilled worker"
                value={form.visa_type_interest}
                onChange={(e) => update("visa_type_interest", e.target.value)}
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => update("notes", e.target.value)} />
            </div>

            {error && <p className="text-sm text-signal-rejected">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create lead"}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </AppShell>
  );
}

export default function NewLeadPage() {
  return (
    <ProtectedRoute>
      <NewLeadContent />
    </ProtectedRoute>
  );
}
