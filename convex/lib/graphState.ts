import type { MutationCtx } from "../_generated/server";

const GRAPH_META_KEY = "primary";

const ensureMetaRow = async (ctx: MutationCtx) => {
  const existing = await ctx.db
    .query("graph_meta")
    .withIndex("by_key", (q) => q.eq("key", GRAPH_META_KEY))
    .first();

  if (existing) return existing;

  const id = await ctx.db.insert("graph_meta", {
    key: GRAPH_META_KEY,
    dirtySince: Date.now(),
    lastBuiltAt: undefined
  });

  return await ctx.db.get(id);
};

export const getGraphMeta = async (ctx: MutationCtx) => {
  const row = await ensureMetaRow(ctx);
  if (!row) {
    throw new Error("Failed to create graph meta row.");
  }
  return row;
};

export const markGraphDirty = async (ctx: MutationCtx) => {
  const meta = await getGraphMeta(ctx);
  await ctx.db.patch(meta._id, {
    dirtySince: meta.dirtySince ?? Date.now()
  });
};

export const clearGraphDirty = async (ctx: MutationCtx, builtAt: number) => {
  const meta = await getGraphMeta(ctx);
  await ctx.db.patch(meta._id, {
    dirtySince: undefined,
    lastBuiltAt: builtAt
  });
};
