"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export function SessionExpiryBanner() {
  const { sessionExpiringSoon, extendSession } = useAuth();
  const [extending, setExtending] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!sessionExpiringSoon || dismissed) return null;

  async function handleExtend() {
    setExtending(true);
    try {
      await extendSession();
    } finally {
      setExtending(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-signal-pending/30 bg-signal-pending/10 px-6 py-2 text-sm">
      <span className="text-ink">Your session is about to expire.</span>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleExtend} disabled={extending}>
          {extending ? "Extending..." : "Stay signed in"}
        </Button>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-ink-muted hover:text-ink"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
