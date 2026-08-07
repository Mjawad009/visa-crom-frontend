"use client";

import { useState } from "react";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function CaseAIPanel({ caseId, clientId }: { caseId: string; clientId: string }) {
  const { hasPermission } = useAuth();

  const [purpose, setPurpose] = useState("visa application cover letter");
  const [context, setContext] = useState("");
  const [letter, setLetter] = useState<string | null>(null);
  const [letterLoading, setLetterLoading] = useState(false);

  const [missing, setMissing] = useState<{ missing_categories: string[]; summary: string } | null>(null);
  const [missingLoading, setMissingLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  if (!hasPermission("ai.use_assistant")) return null;

  async function handleGenerateLetter(e: React.FormEvent) {
    e.preventDefault();
    setLetterLoading(true);
    setError(null);
    try {
      const res = await authedApiClient.post<{ content: string }>("/ai/generate-cover-letter", {
        client_id: clientId, case_id: caseId, purpose, additional_context: context,
      });
      setLetter(res.content);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate a letter.");
    } finally {
      setLetterLoading(false);
    }
  }

  async function handleCheckMissing() {
    setMissingLoading(true);
    setError(null);
    try {
      const res = await authedApiClient.post<{ missing_categories: string[]; summary: string }>(
        "/ai/missing-documents",
        { entity_type: "case", entity_id: caseId }
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
          <p className="mb-2 text-sm font-medium text-ink">Cover letter generator</p>
          <form onSubmit={handleGenerateLetter} className="space-y-2">
            <div>
              <Label>Purpose</Label>
              <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
            </div>
            <Textarea
              rows={2}
              placeholder="Additional context (optional)"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={letterLoading}>
              {letterLoading ? "Generating..." : "Generate letter"}
            </Button>
          </form>
          {letter && <p className="mt-2 rounded bg-paper p-3 text-sm text-ink whitespace-pre-wrap">{letter}</p>}
        </div>

        {error && <p className="text-sm text-signal-rejected">{error}</p>}
      </CardContent>
    </Card>
  );
}
