import type { Doc, Id } from "../_generated/dataModel";

export type GraphNode = {
  id: string;
  name: string;
  avatarUrl?: string;
  fireScore: number;
};

export type GraphEdge = {
  source: string;
  target: string;
  kind: "connection" | "vouch";
};

export type GraphSnapshot = {
  version: number;
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export const buildGraphSnapshot = ({
  profiles,
  connections,
  vouches,
  version,
  fireByProfile
}: {
  profiles: Doc<"profiles">[];
  connections: Doc<"connections">[];
  vouches: Doc<"vouches">[];
  version: number;
  fireByProfile: Map<Id<"profiles">, number>;
}): GraphSnapshot => {
  const nodes = profiles
    .map((profile) => ({
      id: profile._id,
      name: profile.fullName,
      avatarUrl: profile.avatarUrl,
      fireScore: fireByProfile.get(profile._id) ?? 0
    }))
    .sort((a, b) => b.fireScore - a.fireScore || a.name.localeCompare(b.name));

  const connectionSeen = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const connection of connections) {
    const [a, b] = [connection.sourceProfileId, connection.targetProfileId].sort();
    const key = `${a}::${b}`;
    if (!connectionSeen.has(key)) {
      connectionSeen.add(key);
      edges.push({ source: a, target: b, kind: "connection" });
    }
  }

  for (const vouch of vouches) {
    edges.push({
      source: vouch.voucherProfileId,
      target: vouch.targetProfileId,
      kind: "vouch"
    });
  }

  return {
    version,
    generatedAt: new Date().toISOString(),
    nodes,
    edges
  };
};
