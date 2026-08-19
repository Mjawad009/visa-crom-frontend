import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "approved" | "pending" | "rejected" | "info";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-paper text-ink-muted border-line",
  approved: "bg-signal-approved/10 text-signal-approved border-signal-approved/30",
  pending: "bg-signal-pending/10 text-signal-pending border-signal-pending/30",
  rejected: "bg-signal-rejected/10 text-signal-rejected border-signal-rejected/30",
  info: "bg-signal-info/10 text-signal-info border-signal-info/30",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Plain status pill — use for lightweight, low-emphasis labels (counts, tags). */
export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}

/**
 * StampBadge — the design system's signature element.
 *
 * Every case, document, and application in this CRM passes through a
 * workflow stage (see the Workflow Engine, Phase 2). This is the one
 * place the design takes a visible risk: a perforated, stamp-like badge
 * that reads as "this has been through processing" — echoing a visa
 * stamp or ticket stub — reserved *only* for workflow/status states, so
 * it stays meaningful instead of decorative.
 */
export function StampBadge({
  className,
  tone = "neutral",
  children,
  ...props
}: BadgeProps) {
  const dotClass: Record<BadgeTone, string> = {
    neutral: "bg-ink-muted",
    approved: "bg-signal-approved",
    pending: "bg-signal-pending",
    rejected: "bg-signal-rejected",
    info: "bg-signal-info",
  };

  return (
    <span
      className={cn(
        "stamp-perforation relative inline-flex items-center gap-1.5 rounded border px-2.5 py-1",
        "font-mono text-[11px] font-medium uppercase tracking-wider",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClass[tone])} />
      {children}
    </span>
  );
}
