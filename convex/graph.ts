import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";
import { resolveProfileAvatarUrl } from "./lib/avatar";
import { buildGraphSnapshot } from "./lib/graph";
import { clearGraphDirty, getGraphMeta, markGraphDirty } from "./lib/graphState";

const GRAPH_META_KEY = "primary";
const GRAPH_SNAPSHOT_RETENTION_LIMIT = 100;

const getApprovedProfiles = async (ctx: { db: any }) => {
  return (await ctx.db.query("profiles").collect()) as Doc<"profiles">[];
};

const snapshotByteSize = (snapshot: unknown) => new TextEncoder().encode(JSON.stringify(snapshot)).length;

const pruneOldSnapshots = async (ctx: any) => {
  const allSnapshots = (await ctx.db.query("graph_snapshots").collect()) as Doc<"graph_snapshots">[];
  if (allSnapshots.length <= GRAPH_SNAPSHOT_RETENTION_LIMIT) {
    return 0;
  }

  const staleSnapshots = allSnapshots
    .sort((a, b) => b.generatedAt - a.generatedAt)
    .slice(GRAPH_SNAPSHOT_RETENTION_LIMIT);

  for (const snapshot of staleSnapshots) {
    await ctx.db.delete(snapshot._id);
  }

  return staleSnapshots.length;
};

const buildFireScores = ({
  vouches,
  approvedSet
}: {
  vouches: Doc<"vouches">[];
  approvedSet: Set<Id<"profiles">>;
}) => {
  const scoreMap = new Map<Id<"profiles">, Set<Id<"profiles">>>();

  for (const vouch of vouches) {
    if (!approvedSet.has(vouch.voucherProfileId) || !approvedSet.has(vouch.targetProfileId)) continue;
    if (vouch.voucherProfileId === vouch.targetProfileId) continue;

    if (!scoreMap.has(vouch.targetProfileId)) {
      scoreMap.set(vouch.targetProfileId, new Set());
    }

    scoreMap.get(vouch.targetProfileId)!.add(vouch.voucherProfileId);
  }

  const flattened = new Map<Id<"profiles">, number>();
  for (const [targetId, voucherSet] of scoreMap.entries()) {
    flattened.set(targetId, voucherSet.size);
  }

  return flattened;
};

export const rebuildGraphSnapshotNow = async (ctx: any, now: number) => {
  const startedAt = Date.now();
  const profiles = await getApprovedProfiles(ctx);
  const approvedSet = new Set(profiles.map((profile) => profile._id));

  const allConnections = (await ctx.db.query("connections").collect()) as Doc<"connections">[];
  const filteredConnections = allConnections.filter(
    (connection) =>
      approvedSet.has(connection.sourceProfileId) &&
      approvedSet.has(connection.targetProfileId) &&
      connection.sourceProfileId !== connection.targetProfileId
  );

  const allVouches = (await ctx.db.query("vouches").collect()) as Doc<"vouches">[];
  const filteredVouches = allVouches.filter(
    (vouch) =>
      approvedSet.has(vouch.voucherProfileId) && approvedSet.has(vouch.targetProfileId) && vouch.voucherProfileId !== vouch.targetProfileId
  );

  const fireByProfile = buildFireScores({ vouches: filteredVouches, approvedSet });

  const currentRows = (await ctx.db
    .query("graph_snapshots")
    .withIndex("by_is_current", (q: any) => q.eq("isCurrent", true))
    .collect()) as Doc<"graph_snapshots">[];

  for (const row of currentRows) {
    await ctx.db.patch(row._id, { isCurrent: false });
  }

  const latestVersion = currentRows.reduce((max, row) => Math.max(max, row.version), 0);
  const version = latestVersion + 1;

  const snapshot = buildGraphSnapshot({
    profiles,
    connections: filteredConnections,
    vouches: filteredVouches,
    version,
    fireByProfile
  });

  const insertedSnapshotId = await ctx.db.insert("graph_snapshots", {
    version,
    isCurrent: true,
    snapshot,
    generatedAt: now
  });

  await clearGraphDirty(ctx, now);

  const deletedSnapshots = await pruneOldSnapshots(ctx);
  const rebuildDurationMs = Date.now() - startedAt;
  const snapshotBytes = snapshotByteSize(snapshot);

  await ctx.db.insert("audit_log", {
    action: "graph.snapshot.rebuild",
    entityType: "graph_snapshot",
    entityId: insertedSnapshotId,
    metadata: {
      version,
      nodeCount: snapshot.nodes.length,
      edgeCount: snapshot.edges.length,
      snapshotBytes,
      rebuildDurationMs,
      deletedSnapshots
    },
    createdAt: Date.now()
  });
};

export const getCurrentSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const meta = await ctx.db
      .query("graph_meta")
      .withIndex("by_key", (q) => q.eq("key", GRAPH_META_KEY))
      .first();

    const row = await ctx.db
      .query("graph_snapshots")
      .withIndex("by_is_current", (q) => q.eq("isCurrent", true))
      .first();

    if (!row) {
      return {
        version: 0,
        currentVersion: 0,
        generatedAt: new Date(0).toISOString(),
        nodes: [],
        edges: [],
        dirty: Boolean(meta?.dirtySince),
        dirtySince: meta?.dirtySince,
        lastBuiltAt: meta?.lastBuiltAt
      };
    }

    const profiles = await ctx.db.query("profiles").collect();
    const profileById = new Map(profiles.map((profile) => [profile._id, profile]));

    const nodes = await Promise.all(
      row.snapshot.nodes.map(async (node) => {
        const profile = profileById.get(node.id as Id<"profiles">);
        if (!profile) return node;
        const avatarUrl = await resolveProfileAvatarUrl(ctx, profile);

        return {
          ...node,
          avatarUrl
        };
      })
    );

    return {
      ...row.snapshot,
      currentVersion: row.version,
      dirty: Boolean(meta?.dirtySince),
      dirtySince: meta?.dirtySince,
      lastBuiltAt: meta?.lastBuiltAt,
      nodes
    };
  }
});

export const getCurrentStatus = query({
  args: {},
  handler: async (ctx) => {
    const meta = await ctx.db
      .query("graph_meta")
      .withIndex("by_key", (q) => q.eq("key", GRAPH_META_KEY))
      .first();

    const row = await ctx.db
      .query("graph_snapshots")
      .withIndex("by_is_current", (q) => q.eq("isCurrent", true))
      .first();

    return {
      currentVersion: row?.version ?? 0,
      generatedAt: row ? new Date(row.generatedAt).toISOString() : undefined,
      dirty: Boolean(meta?.dirtySince),
      dirtySince: meta?.dirtySince,
      lastBuiltAt: meta?.lastBuiltAt
    };
  }
});

export const markDirty = internalMutation({
  args: {
    reason: v.string(),
    actorAuthUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await markGraphDirty(ctx);

    await ctx.db.insert("audit_log", {
      actorAuthUserId: args.actorAuthUserId,
      action: "graph.mark_dirty",
      entityType: "graph_snapshot",
      entityId: "primary",
      metadata: { reason: args.reason },
      createdAt: Date.now()
    });
  }
});

export const rebuildIfDirty = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const meta = await getGraphMeta(ctx);

    if (!meta.dirtySince) {
      return { rebuilt: false, reason: "clean" as const };
    }

    if (meta.lastBuiltAt && now - meta.lastBuiltAt < 60_000) {
      return { rebuilt: false, reason: "throttled" as const };
    }

    await rebuildGraphSnapshotNow(ctx, now);
    return { rebuilt: true, reason: "dirty" as const };
  }
});

export const forceRebuild = internalMutation({
  args: {},
  handler: async (ctx) => {
    await rebuildGraphSnapshotNow(ctx, Date.now());
    return { rebuilt: true };
  }
});

export const ensureGraphInitialized = internalMutation({
  args: {},
  handler: async (ctx) => {
    const current = await ctx.db
      .query("graph_snapshots")
      .withIndex("by_is_current", (q) => q.eq("isCurrent", true))
      .first();

    if (!current) {
      await rebuildGraphSnapshotNow(ctx, Date.now());
      return { initialized: true };
    }

    return { initialized: false };
  }
});

export const assertNoSelfEdge = ({ sourceId, targetId }: { sourceId: string; targetId: string }) => {
  if (sourceId === targetId) {
    throw new ConvexError("Self-references are not allowed.");
  }
};
