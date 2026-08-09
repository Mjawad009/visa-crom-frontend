"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";
import { getHomeRoute } from "@/lib/role-routes";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password, rememberMe);
      router.push(getHomeRoute(user?.role_key));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper p-4">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="p-2">
          <CardContent className="pt-4">
            <h1 className="mb-1 font-display text-lg font-medium text-ink">Sign in</h1>
            <p className="mb-6 text-sm text-ink-muted">Visa Consultancy CRM</p>

            <div className="mb-4">
              <Label>Email</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="mb-4">
              <Label>Password</Label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <label className="mb-4 flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-line"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me on this device
            </label>

            {error && <p className="mb-4 text-sm text-signal-rejected">{error}</p>}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </main>
  );
}
