"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Wrap any page that requires authentication. Role-specific portals
 * (Phase 3+) will layer their own permission checks on top of this
 * using `useAuth().hasPermission(...)`.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-muted">
        Loading...
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
