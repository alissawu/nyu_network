import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { magicLink } from "better-auth/plugins";
import authConfig from "./auth.config";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const authComponent = createClient<DataModel>(components.betterAuth);

const sendMagicLink = async (email: string, url: string) => {
  const appUrl = requiredEnv("BETTER_AUTH_URL");
  const secret = process.env.MAGIC_LINK_MAILER_SECRET ?? requiredEnv("BETTER_AUTH_SECRET");

  const response = await fetch(`${appUrl}/api/internal/magic-link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`
    },
    body: JSON.stringify({ email, url })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to send magic link email: ${text}`);
  }
};

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  const baseUrl = requiredEnv("BETTER_AUTH_URL");
  const secret = requiredEnv("BETTER_AUTH_SECRET");

  return {
    appName: "NYU Network",
    baseURL: baseUrl,
    secret,
    database: authComponent.adapter(ctx),
    plugins: [
      convex({ authConfig }),
      magicLink({
        sendMagicLink: async ({ email, url }) => sendMagicLink(email, url)
      })
    ],
    trustedOrigins: [baseUrl],
    emailAndPassword: {
      enabled: false
    }
  } satisfies BetterAuthOptions;
};

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth(createAuthOptions(ctx));
