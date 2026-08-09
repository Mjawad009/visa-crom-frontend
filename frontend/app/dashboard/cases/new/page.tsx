"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { Case } from "@/lib/types/case";
import { Client } from "@/lib/types/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

function NewCaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get("clientId");

  const [client, setClient] = useState<Client | null>(null);
  const [form, setForm] = useState({
    case_type: "study_visa",
    destination_country: "",
    visa_type: "",
    priority: "normal",
    target_submission_date: "",
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
      setError("A case must be opened from a client's profile.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        client_id: clientId,
        destination_country: form.destination_country || undefined,
        visa_type: form.visa_type || undefined,
        target_submission_date: form.target_submission_date || undefined,
        notes: form.notes || undefined,
      };
      const created = await authedApiClient.post<Case>("/cases/", payload);
      router.push(`/dashboard/cases/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create case.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!clientId) {
    return (
      <AppShell title="New case">
        <p className="text-sm text-signal-rejected">
          Open a case from a client's profile — this page needs a client to attach the case to.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell title="New case">
      <Card className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 py-5">
            <p className="text-xs text-ink-muted">
              For client: <span className="font-medium text-ink">{client?.full_name ?? "loading..."}</span>
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Case type</Label>
                <Select value={form.case_type} onChange={(e) => update("case_type", e.target.value)}>
                  <option value="study_visa">Study Visa</option>
                  <option value="skilled_worker">Skilled Worker</option>
                  <option value="visitor_visa">Visitor Visa</option>
                  <option value="family_visa">Family Visa</option>
                  <option value="other">Other</option>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onChange={(e) => update("priority", e.target.value)}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Destination country</Label>
                <Input value={form.destination_country} onChange={(e) => update("destination_country", e.target.value)} />
              </div>
              <div>
                <Label>Visa type</Label>
                <Input value={form.visa_type} onChange={(e) => update("visa_type", e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Target submission date</Label>
              <Input type="date" value={form.target_submission_date} onChange={(e) => update("target_submission_date", e.target.value)} />
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
                {submitting ? "Creating..." : "Open case"}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </AppShell>
  );
}

export default function NewCasePage() {
  return (
    <ProtectedRoute>
      <NewCaseContent />
    </ProtectedRoute>
  );
}
