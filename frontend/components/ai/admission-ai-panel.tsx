"use client";

import { useState } from "react";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AdmissionAIPanel({ admissionId, clientId }: { admissionId: string; clientId: string }) {
  const { hasPermission } = useAuth();

  const [context, setContext] = useState("");
  const [sop, setSop] = useState<string | null>(null);
  const [sopLoading, setSopLoading] = useState(false);

  const [missing, setMissing] = useState<{ missing_categories: string[]; summary: string } | null>(null);
  const [missingLoading, setMissingLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  if (!hasPermission("ai.use_assistant")) return null;

  async function handleGenerateSOP(e: React.FormEvent) {
    e.preventDefault();
    setSopLoading(true);
    setError(null);
    try {
      const res = await authedApiClient.post<{ content: string }>("/ai/generate-sop", {
        client_id: clientId, admission_id: admissionId, additional_context: context,
      });
      setSop(res.content);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate a draft.");
    } finally {
      setSopLoading(false);
    }
  }

  async function handleCheckMissing() {
    setMissingLoading(true);
    setError(null);
    try {
      const res = await authedApiClient.post<{ missing_categories: string[]; summary: string }>(
        "/ai/missing-documents",
        { entity_type: "admission", entity_id: admissionId }
      );
      setMissing(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not check documents.");
    } finally {
      setMissingLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Tools</CardTitle>
        <CardDescription>Draft assistance — always review before sharing with a client.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Button size="sm" variant="secondary" disabled={missingLoading} onClick={handleCheckMissing}>
            {missingLoading ? "Checking..." : "Check for missing documents"}
          </Button>
          {missing && (
            <div className="mt-2 rounded bg-paper p-3 text-sm text-ink">
              <p className="whitespace-pre-wrap">{missing.summary}</p>
              {missing.missing_categories.length > 0 && (
                <p className="mt-1 text-xs text-ink-muted">
                  Missing: {missing.missing_categories.map((c) => c.replace(/_/g, " ")).join(", ")}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-line pt-4">
          <p className="mb-2 text-sm font-medium text-ink">SOP generator</p>
          <form onSubmit={handleGenerateSOP} className="space-y-2">
            <Textarea
              rows={3}
              placeholder="Career goals, background, why this program (optional but helps)"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={sopLoading}>
              {sopLoading ? "Generating..." : "Generate SOP draft"}
            </Button>
          </form>
          {sop && <p className="mt-2 rounded bg-paper p-3 text-sm text-ink whitespace-pre-wrap">{sop}</p>}
        </div>

        {error && <p className="text-sm text-signal-rejected">{error}</p>}
      </CardContent>
    </Card>
  );
}
