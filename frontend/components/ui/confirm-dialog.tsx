"use client";

import { useState, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  trigger: (open: () => void) => ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

/**
 * Renders whatever trigger element the caller wants (a button, usually)
 * and shows a modal confirmation before actually running onConfirm.
 * Used anywhere an action can't be undone from the UI — deactivating a
 * branch/user/client, deleting a role, etc.
 */
export function ConfirmDialog({ trigger, title, description, confirmLabel = "Confirm", danger, onConfirm }: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {trigger(() => setOpen(true))}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
          <div className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-lg">
            <h3 className="font-display text-base font-medium text-ink">{title}</h3>
            <p className="mt-2 text-sm text-ink-muted">{description}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant={danger ? "danger" : "primary"} size="sm" onClick={handleConfirm} disabled={busy}>
                {busy ? "Working..." : confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
