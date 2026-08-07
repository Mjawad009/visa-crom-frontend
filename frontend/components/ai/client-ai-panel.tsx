"use client";

import { useState } from "react";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function ClientAIPanel({ clientId }: { clientId: string }) {
  const { hasPermission } = useAuth();
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("study");
  const [background, setBackground] = useState("");
  const [pathway, setPathway] = useState<{ suggestions: string; disclaimer: string } | null>(null);
  const [pathwayLoading, setPathwayLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  if (!hasPermission("ai.use_assistant")) return null;

  async function handleSummary() {
    setSummaryLoading(true);
    setError(null);
    try {
      const res = await authedApiClient.post<{ summary: string }>("/ai/client-summary", { client_id: clientId });
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate a summary.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handlePathway(e: React.FormEvent) {
    e.preventDefault();
    setPathwayLoading(true);
    setError(null);
    try {
      const res = await authedApiClient.post<{ suggestions: string; disclaimer: string }>(
        "/ai/visa-pathway-suggestions",
        { client_id: clientId, destination_country: destination, purpose, background_notes: background }
      );
      setPathway(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate suggestions.");
    } finally {
      setPathwayLoading(false);
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
          <Button size="sm" variant="secondary" disabled={summaryLoading} onClick={handleSummary}>
            {summaryLoading ? "Generating..." : "Generate client summary"}
          </Button>
          {summary && <p className="mt-2 rounded bg-paper p-3 text-sm text-ink whitespace-pre-wrap">{summary}</p>}
        </div>

        <div className="border-t border-line pt-4">
          <p className="mb-2 text-sm font-medium text-ink">Visa pathway suggestions</p>
          <form onSubmit={handlePathway} className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Destination country</Label>
                <Input required value={destination} onChange={(e) => setDestination(e.target.value)} />
              </div>
              <div>
                <Label>Purpose</Label>
                <Select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                  <option value="study">Study</option>
                  <option value="work">Work</option>
                  <option value="visit">Visit</option>
                  <option value="family">Family</option>
                  <option value="other">Other</option>
                </Select>
              </div>
            </div>
            <Textarea
              rows={2}
              placeholder="Background notes (optional)"
              value={background}
              onChange={(e) => setBackground(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={pathwayLoading}>
              {pathwayLoading ? "Generating..." : "Suggest pathways"}
            </Button>
          </form>
          {pathway && (
            <div className="mt-2 space-y-1">
              <p className="rounded bg-paper p-3 text-sm text-ink whitespace-pre-wrap">{pathway.suggestions}</p>
              <p className="text-xs italic text-ink-muted">{pathway.disclaimer}</p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-signal-rejected">{error}</p>}
      </CardContent>
    </Card>
  );
}
