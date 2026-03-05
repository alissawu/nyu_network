"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { type ReactNode, useMemo } from "react";
import { authClient } from "@/lib/auth-client";

export const Providers = ({ children, initialToken }: { children: ReactNode; initialToken: string | null }) => {
  const client = useMemo(() => new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!), []);

  return (
    <ConvexBetterAuthProvider client={client} authClient={authClient} initialToken={initialToken ?? undefined}>
      {children}
    </ConvexBetterAuthProvider>
  );
};
