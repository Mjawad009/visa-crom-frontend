import { Button } from "@/components/ui/button";
import { Badge, StampBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";

const swatches = [
  { name: "ink", hex: "#14203D", className: "bg-ink" },
  { name: "paper", hex: "#F5F7F9", className: "bg-paper border border-line" },
  { name: "surface", hex: "#FFFFFF", className: "bg-surface border border-line" },
  { name: "brass", hex: "#A87C2A", className: "bg-brass" },
  { name: "signal-approved", hex: "#1E7F55", className: "bg-signal-approved" },
  { name: "signal-pending", hex: "#B07A1E", className: "bg-signal-pending" },
  { name: "signal-rejected", hex: "#B23B32", className: "bg-signal-rejected" },
  { name: "signal-info", hex: "#2A5FA5", className: "bg-signal-info" },
];

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 p-10">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-brass">Phase 3</p>
        <h1 className="mt-1 font-display text-3xl font-medium text-ink">Design System</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Tokens and components shared by every role portal. Palette and type
          are grounded in official travel documents — navy for authority,
          brass for a seal-like accent, a perforated stamp badge for
          workflow status.
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink">Color</h2>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
          {swatches.map((s) => (
            <div key={s.name}>
              <div className={`h-14 w-full rounded ${s.className}`} />
              <p className="mt-1.5 text-xs font-medium text-ink">{s.name}</p>
              <p className="font-mono text-[10px] text-ink-muted">{s.hex}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink">Type</h2>
        <div className="space-y-3">
          <p className="font-display text-2xl text-ink">Fraunces — page titles &amp; headers</p>
          <p className="text-base text-ink">Inter — UI text and body copy, set for data density</p>
          <p className="font-mono text-sm text-ink">IBM Plex Mono — case refs, IDs, timestamps</p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Save changes</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="danger">Delete</Button>
          <Button variant="primary" size="sm">Small</Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink">Badges &amp; the stamp signature</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="neutral">Draft</Badge>
          <Badge tone="info">3 new</Badge>
          <StampBadge tone="pending">Document Collection</StampBadge>
          <StampBadge tone="info">Submitted</StampBadge>
          <StampBadge tone="approved">Decision — Approved</StampBadge>
          <StampBadge tone="rejected">Rejected</StampBadge>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink">Form controls</h2>
        <Card className="max-w-sm">
          <CardContent className="space-y-3 py-5">
            <div>
              <Label>Full name</Label>
              <Input placeholder="Jane Consultant" />
            </div>
            <div>
              <Label>Branch code</Label>
              <Input placeholder="LON-01" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink">Card</h2>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Branch summary</CardTitle>
            <CardDescription>London — 14 active staff</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-muted">Card content area for stats, forms, or lists.</p>
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink">Table</h2>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Role</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell className="flex items-center gap-2">
                <Avatar name="Jane Doe" /> Jane Doe
              </TableCell>
              <TableCell>Consultant</TableCell>
              <TableCell><Badge tone="approved">Active</Badge></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg text-ink">Empty state</h2>
        <EmptyState
          title="No cases yet"
          description="Cases will appear here once the Cases module ships in Phase 6."
        />
      </section>
    </div>
  );
}
