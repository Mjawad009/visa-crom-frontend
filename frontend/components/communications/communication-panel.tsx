"use client";

import { useEffect, useState } from "react";
import { authedApiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { CommunicationLog } from "@/lib/types/communication";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface CommunicationPanelProps {
  entityType: string;
  entityId: string;
  defaultRecipientEmail?: string | null;
}

export function CommunicationPanel({ entityType, entityId, defaultRecipientEmail }: CommunicationPanelProps) {
  const { hasPermission } = useAuth();
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [channel, setChannel] = useState<"email" | "internal_note">("internal_note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await authedApiClient.get<CommunicationLog[]>(
        `/communications/?entity_type=${entityType}&entity_id=${entityId}`
      );
      setLogs(data);
    } catch {
      setError("Could not load communication history.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, entityId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await authedApiClient.post("/communications/", {
        entity_type: entityType,
        entity_id: entityId,
        channel,
        subject: subject || undefined,
        body,
        recipient_email: channel === "email" ? recipientEmail : undefined,
      });
      setBody("");
      setSubject("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send.");
    } finally {
      setSending(false);
    }
  }

  const canSend = hasPermission("communication.send");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Communication</CardTitle>
        <CardDescription>Emails sent and internal notes, in one timeline.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canSend && (
          <form onSubmit={handleSend} className="space-y-2 rounded border border-dashed border-line p-3">
            <div className="flex gap-2">
              <Select value={channel} onChange={(e) => setChannel(e.target.value as "email" | "internal_note")} className="max-w-[160px]">
                <option value="internal_note">Internal note</option>
                <option value="email">Email</option>
              </Select>
              {channel === "email" && (
                <Input
                  type="email"
                  required
                  placeholder="Recipient email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              )}
            </div>
            {channel === "email" && (
              <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            )}
            <Textarea
              rows={2}
              required
              placeholder={channel === "email" ? "Email body..." : "Note for the team..."}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={sending}>
                {sending ? "Sending..." : channel === "email" ? "Send email" : "Add note"}
              </Button>
            </div>
          </form>
        )}

        {logs.length === 0 && <p className="text-sm text-ink-muted">No communication history yet.</p>}

        {logs.map((log) => (
          <div key={log.id} className="rounded border border-line p-3">
            <div className="flex items-center justify-between">
              <Badge tone={log.channel === "email" ? "info" : "neutral"}>
                {log.channel === "email" ? `Email to ${log.recipient_email}` : "Internal note"}
              </Badge>
              <span className="text-xs text-ink-muted">{new Date(log.created_at).toLocaleString()}</span>
            </div>
            {log.subject && <p className="mt-1.5 text-sm font-medium text-ink">{log.subject}</p>}
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{log.body}</p>
          </div>
        ))}

        {error && <p className="text-sm text-signal-rejected">{error}</p>}
      </CardContent>
    </Card>
  );
}
