"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export const AuthControls = () => {
  const { data: session, isPending } = authClient.useSession();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await authClient.signOut();
    } finally {
      setLoading(false);
    }
  };

  if (isPending) {
    return <p className="mono text-xs text-[var(--muted)]">Loading auth...</p>;
  }

  if (!session?.user) {
    return <p className="mono text-xs text-[var(--muted)]">Not signed in</p>;
  }

  return (
    <div className="flex items-center gap-3">
      <p className="mono text-xs text-[var(--muted)]">{session.user.email}</p>
      <button type="button" onClick={handleSignOut} disabled={loading} className="brutal-btn bg-[var(--paper)]">
        {loading ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
};
