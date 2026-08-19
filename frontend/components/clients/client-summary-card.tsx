"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authedApiClient } from "@/lib/api-client";
import { Client } from "@/lib/types/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Shows the full linked client's key details on a Case/Admission
 * detail page — before this, those pages only had a client_id with
 * nothing rendered from it, so there was no way to see who the case
 * actually belonged to without leaving the page. */
export function ClientSummaryCard({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    authedApiClient.get<Client>(`/clients/${clientId}`).then(setClient).catch(() => setClient(null));
  }, [clientId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Client</CardTitle>
      </CardHeader>
      <CardContent>
        {!client && <p className="text-sm text-ink-muted">Loading...</p>}
        {client && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <Link href={`/dashboard/clients/${client.id}`} className="font-medium text-ink hover:underline">
                {client.full_name}
              </Link>
              <Badge tone={client.is_active ? "approved" : "neutral"}>{client.is_active ? "Active" : "Inactive"}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-ink-muted">
              <div>
                <p className="uppercase tracking-wide">Email</p>
                <p className="text-ink">{client.email ?? "—"}</p>
              </div>
              <div>
                <p className="uppercase tracking-wide">Phone</p>
                <p className="text-ink">{client.phone ?? "—"}</p>
              </div>
              <div>
                <p className="uppercase tracking-wide">Nationality</p>
                <p className="text-ink">{client.nationality ?? "—"}</p>
              </div>
              <div>
                <p className="uppercase tracking-wide">Passport</p>
                <p className="font-mono text-ink">{client.passport_number ?? "—"}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
