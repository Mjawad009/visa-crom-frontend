"use client";

import { ReactNode, useState } from "react";
import { SidebarNav } from "./sidebar-nav";
import { Topbar } from "./topbar";
import { SessionExpiryBanner } from "./session-expiry-banner";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen bg-paper">
      <SidebarNav mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <SessionExpiryBanner />
        <Topbar title={title} onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
