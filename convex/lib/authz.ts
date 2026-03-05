import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authComponent } from "../auth";

type Ctx = QueryCtx | MutationCtx;

type AuthUserLike = {
  _id: string;
  userId?: string | null;
  email?: string | null;
};

export const getAuthUserId = (user: AuthUserLike) => (user.userId?.trim() ? user.userId : user._id);
export const getAuthEmail = (user: AuthUserLike) => (user.email ?? "").trim().toLowerCase();

export const requireAuthUser = async (ctx: Ctx) => {
  const user = (await authComponent.safeGetAuthUser(ctx)) as AuthUserLike | undefined;
  if (!user) {
    throw new ConvexError("Unauthorized");
  }
  return user;
};

export const requireAdmin = async (ctx: Ctx) => {
  const user = await requireAuthUser(ctx);
  const email = getAuthEmail(user);
  if (!email) {
    throw new ConvexError("No email found for authenticated user.");
  }

  const adminRow = await ctx.db
    .query("admin_allowlist")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();

  if (!adminRow) {
    throw new ConvexError("Admin access required.");
  }

  return user;
};

export const requireApprovedMember = async (ctx: Ctx): Promise<{
  authUser: AuthUserLike;
  memberAccount: Doc<"member_accounts">;
  profile: Doc<"profiles">;
}> => {
  const authUser = await requireAuthUser(ctx);
  const authUserId = getAuthUserId(authUser);
  const memberAccount = await ctx.db
    .query("member_accounts")
    .withIndex("by_auth_user", (q) => q.eq("authUserId", authUserId))
    .first();

  if (!memberAccount) {
    throw new ConvexError("This account is not linked to an approved profile.");
  }

  const profile = await ctx.db.get(memberAccount.profileId);
  if (!profile) {
    throw new ConvexError("Linked profile is missing.");
  }

  return { authUser, memberAccount, profile };
};
