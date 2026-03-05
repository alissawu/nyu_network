"use client";

import { useEffect, useMemo, useState } from "react";

type GraphSnapshot = {
  version: number;
  generatedAt: string;
  nodes: Array<{ id: string; name: string; avatarUrl?: string; fireScore: number }>;
  edges: Array<{ source: string; target: string; kind: "connection" | "vouch" }>;
};

const WIDTH = 1000;
const HEIGHT = 640;

const positionNodes = (nodes: GraphSnapshot["nodes"]) => {
  const centerX = WIDTH / 2;
  const centerY = HEIGHT / 2;

  return nodes.map((node, index) => {
    const ring = Math.floor(index / 14) + 1;
    const positionInRing = index % 14;
    const pointsOnRing = Math.min(14, nodes.length - (ring - 1) * 14);
    const angle = (positionInRing / Math.max(pointsOnRing, 1)) * Math.PI * 2;
    const radius = 110 + ring * 90;

    return {
      ...node,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius
    };
  });
};

export default function GraphPage() {
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const response = await fetch("/api/graph", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load graph snapshot.");
        }
        setSnapshot((await response.json()) as GraphSnapshot);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load graph.");
      }
    };

    load();
  }, []);

  const positioned = useMemo(() => (snapshot ? positionNodes(snapshot.nodes) : []), [snapshot]);
  const byId = useMemo(() => new Map(positioned.map((node) => [node.id, node])), [positioned]);

  return (
    <section className="space-y-5">
      <div className="brutal-card p-6">
        <p className="mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Graph View</p>
        <h2 className="text-3xl font-black">NYU Network Map</h2>
        <p className="text-sm text-[var(--muted)]">
          Regular connections render as thin lines. Vouches are rendered with thicker highlight lines.
        </p>
      </div>

      <div className="brutal-card overflow-hidden p-3">
        {error ? <p className="p-6 text-sm text-red-600">{error}</p> : null}
        {!snapshot ? <p className="p-6 text-sm text-[var(--muted)]">Loading graph snapshot...</p> : null}
        {snapshot ? (
          <div className="relative overflow-auto">
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-[680px] w-full min-w-[880px] border-2 border-[var(--border)] bg-white">
              <rect width={WIDTH} height={HEIGHT} fill="#fffef8" />
              {snapshot.edges.map((edge, index) => {
                const source = byId.get(edge.source);
                const target = byId.get(edge.target);
                if (!source || !target) return null;
                return (
                  <line
                    key={`${edge.source}-${edge.target}-${edge.kind}-${index}`}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={edge.kind === "vouch" ? "#f05a24" : "#8f8f86"}
                    strokeWidth={edge.kind === "vouch" ? 3.2 : 1.2}
                    strokeDasharray={edge.kind === "vouch" ? "0" : "4 4"}
                  />
                );
              })}

              {positioned.map((node) => (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  <rect x={-26} y={-26} width={52} height={52} fill="#ffffff" stroke="#141414" strokeWidth={2} />
                  {node.avatarUrl ? (
                    <image href={node.avatarUrl} x={-24} y={-24} width={48} height={48} preserveAspectRatio="xMidYMid slice" style={{ imageRendering: "pixelated" }} />
                  ) : (
                    <text x={0} y={2} textAnchor="middle" fontSize={10} fill="#141414" fontFamily="monospace">
                      NYU
                    </text>
                  )}
                  <text x={0} y={38} textAnchor="middle" fontSize={10} fontFamily="monospace" fill="#141414">
                    {node.name}
                  </text>
                  <text x={0} y={50} textAnchor="middle" fontSize={9} fontFamily="monospace" fill="#f05a24">
                    fire {node.fireScore}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        ) : null}
      </div>

      {snapshot ? (
        <p className="mono text-xs text-[var(--muted)]">
          Snapshot v{snapshot.version} generated at {new Date(snapshot.generatedAt).toLocaleString()}.
        </p>
      ) : null}
    </section>
  );
}
