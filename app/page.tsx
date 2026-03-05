import Link from "next/link";

const bullets = [
  "Apply publicly, but stay pending until admin approval.",
  "Build your own profile connections and top-5 vouches.",
  "Explore graph + fire-ranked search without expensive live joins.",
  "Use admin queues to moderate applicants and profile revisions."
];

export default function HomePage() {
  return (
    <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
      <article className="brutal-card p-6">
        <p className="mono mb-2 text-xs uppercase tracking-[0.3em] text-[var(--muted)]">NYU Community Graph</p>
        <h2 className="mb-4 text-4xl font-black leading-tight">Find the most vouched people and map real campus relationships.</h2>
        <p className="mb-5 text-base text-[var(--muted)]">
          This app keeps submissions pending by default. Members and edges only go live after admin approval.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/apply" className="brutal-btn">
            Apply to Join
          </Link>
          <Link href="/graph" className="brutal-btn bg-[var(--paper)]">
            Open Graph
          </Link>
        </div>
      </article>

      <aside className="brutal-card p-6">
        <h3 className="mono mb-3 text-sm uppercase tracking-wider">What ships in V1</h3>
        <ul className="space-y-3 text-sm">
          {bullets.map((item) => (
            <li key={item} className="border-l-4 border-[var(--accent)] pl-3">
              {item}
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
