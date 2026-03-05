import { mutation } from "./_generated/server";
import { requireAuthUser } from "./lib/authz";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuthUser(ctx);
    return await ctx.storage.generateUploadUrl();
  }
});
