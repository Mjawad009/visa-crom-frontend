"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/lib/protected-route";
import { AppShell } from "@/components/layout/app-shell";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface KnowledgeSource {
  type: string;
  entity_type: string;
  entity_id: string;
  snippet: string;
}

function AIAssistantContent() {
  const [chatInput, setChatInput] = useState("");
  const [chatReply, setChatReply] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function handleChat(e: React.FormEvent) {
    e.preventDefault();
    setChatLoading(true);
    setChatError(null);
    try {
      const res = await authedApiClient.post<{ content: string }>("/ai/chat", {
        messages: [{ role: "user", content: chatInput }],
      });
      setChatReply(res.content);
    } catch (err) {
      setChatError(err instanceof ApiError ? err.message : "The assistant could not respond right now.");
    } finally {
      setChatLoading(false);
    }
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await authedApiClient.post<{ answer: string; sources: KnowledgeSource[] }>(
        "/ai/knowledge-search",
        { query }
      );
      setAnswer(res.answer);
      setSources(res.sources);
    } catch (err) {
      setSearchError(err instanceof ApiError ? err.message : "Search could not run right now.");
    } finally {
      setSearchLoading(false);
    }
  }

  return (
    <AppShell title="AI Assistant">
      <div className="mb-6">
        <h2 className="font-display text-xl font-medium text-ink">AI Assistant</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          General chat, plus a search across internal documents and communication history.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Chat</CardTitle>
            <CardDescription>Ask anything — this doesn't have access to client data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleChat} className="space-y-2">
              <Textarea
                rows={3}
                required
                placeholder="Ask a question..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={chatLoading}>
                {chatLoading ? "Thinking..." : "Ask"}
              </Button>
            </form>
            {chatError && <p className="text-sm text-signal-rejected">{chatError}</p>}
            {chatReply && (
              <div className="rounded bg-paper p-3 text-sm text-ink whitespace-pre-wrap">{chatReply}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Internal Knowledge Search</CardTitle>
            <CardDescription>
              Searches uploaded document text and communication history, then synthesizes an answer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Textarea
                rows={1}
                required
                placeholder="e.g. Has anyone mentioned a delay with the Toronto office?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button type="submit" size="sm" disabled={searchLoading}>
                {searchLoading ? "..." : "Search"}
              </Button>
            </form>
            {searchError && <p className="text-sm text-signal-rejected">{searchError}</p>}
            {answer && (
              <div className="space-y-2">
                <div className="rounded bg-paper p-3 text-sm text-ink whitespace-pre-wrap">{answer}</div>
                {sources.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Sources</p>
                    {sources.map((s, i) => (
                      <div key={i} className="rounded border border-line p-2 text-xs text-ink-muted">
                        <Badge tone="neutral" className="mb-1">{s.type}</Badge>
                        <p className="truncate">{s.snippet}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

export default function AIAssistantPage() {
  return (
    <ProtectedRoute>
      <AIAssistantContent />
    </ProtectedRoute>
  );
}
