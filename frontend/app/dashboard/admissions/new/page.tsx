"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { AdmissionApplication } from "@/lib/types/admission";
import { Client } from "@/lib/types/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function NewAdmissionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get("clientId");

  const [client, setClient] = useState<Client | null>(null);
  const [form, setForm] = useState({
    institution_name: "",
    program_name: "",
    country: "",
    intake_term: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    authedApiClient.get<Client>(`/clients/${clientId}`).then(setClient).catch(() => setClient(null));
  }, [clientId]);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      setError("An admission application must be started from a client's profile.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        client_id: clientId,
        program_name: form.program_name || undefined,
        country: form.country || undefined,
        intake_term: form.intake_term || undefined,
        notes: form.notes || undefined,
      };
      const created = await authedApiClient.post<AdmissionApplication>("/admissions/", payload);
      router.replace(`/dashboard/admissions/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create admission application.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!clientId) {
    return (
      <AppShell title="New admission application">
        <p className="text-sm text-signal-rejected">
          Start an admission application from a client's profile — this page needs a client to attach it to.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="New admission application">
      <Card className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 py-5">
            <p className="text-xs text-ink-muted">
              For client: <span className="font-medium text-ink">{client?.full_name ?? "loading..."}</span>
            </p>

            <div>
              <Label>Institution name</Label>
              <Input required value={form.institution_name} onChange={(e) => update("institution_name", e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Program</Label>
                <Input value={form.program_name} onChange={(e) => update("program_name", e.target.value)} />
              </div>
              <div>
                <Label>Country</Label>
                <Input value={form.country} onChange={(e) => update("country", e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Intake term</Label>
              <Input placeholder="e.g. Fall 2026" value={form.intake_term} onChange={(e) => update("intake_term", e.target.value)} />
            </div>

            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(e) => update("notes", e.target.value)} />
            </div>

            {error && <p className="text-sm text-signal-rejected">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create application"}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </AppShell>
  );
}

export default function NewAdmissionPage() {
  return (
    <ProtectedRoute>
      <NewAdmissionContent />
    </ProtectedRoute>
  );
}
