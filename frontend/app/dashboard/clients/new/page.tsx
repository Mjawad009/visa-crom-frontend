"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { Client } from "@/lib/types/client";
import { Lead } from "@/lib/types/lead";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

function NewClientContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromLeadId = searchParams.get("fromLead");

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    nationality: "",
    passport_number: "",
    passport_expiry: "",
    address: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);

  useEffect(() => {
    if (!fromLeadId) return;
    authedApiClient
      .get<Lead>(`/leads/${fromLeadId}`)
      .then((lead) => {
        setForm((f) => ({
          ...f,
          full_name: lead.full_name,
          email: lead.email ?? "",
          phone: lead.phone ?? "",
        }));
        setPrefillNote(`Prefilled from lead: ${lead.full_name}`);
      })
      .catch(() => setPrefillNote("Could not load the source lead — fill in details manually."));
  }, [fromLeadId]);

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
        date_of_birth: form.date_of_birth || undefined,
        nationality: form.nationality || undefined,
        passport_number: form.passport_number || undefined,
        passport_expiry: form.passport_expiry || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
        lead_id: fromLeadId || undefined,
      };
      const client = await authedApiClient.post<Client>("/clients/", payload);
      router.push(`/dashboard/clients/${client.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create client.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="New client">
      <Card className="max-w-xl">
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 py-5">
            {prefillNote && <p className="text-xs text-ink-muted">{prefillNote}</p>}

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
                <Label>Date of birth</Label>
                <Input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} />
              </div>
              <div>
                <Label>Nationality</Label>
                <Input value={form.nationality} onChange={(e) => update("nationality", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Passport number</Label>
                <Input value={form.passport_number} onChange={(e) => update("passport_number", e.target.value)} />
              </div>
              <div>
                <Label>Passport expiry</Label>
                <Input type="date" value={form.passport_expiry} onChange={(e) => update("passport_expiry", e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Address</Label>
              <Textarea rows={2} value={form.address} onChange={(e) => update("address", e.target.value)} />
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
                {submitting ? "Creating..." : "Create client"}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </AppShell>
  );
}

export default function NewClientPage() {
  return (
    <ProtectedRoute>
      <NewClientContent />
    </ProtectedRoute>
  );
}
