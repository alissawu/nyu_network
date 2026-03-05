/**
 * TorchStem — static stem from the original ASCII art (rows 31-58).
 * Rendered with the same font/sizing as the flame so they align perfectly.
 */

const STEM_ART = [
  "                                   .++++++++++++++++++++-.                                          ",
  "                                  ..@@@@@@@@@@@@@@@@@@@@=.                                          ",
  "                                   .@@@@@@@@@@@@@@@@@@@@=.                                          ",
  "                                   .@@@@@@@@@@@@@@@@@@@@=.                                          ",
  "                                   .......................                                          ",
  "                                      .=@@@@@@@@@@@@#.                                              ",
  "                                      .-@@@@@@@@@@@@*                                               ",
  "                                      ..@@@@@@@@@@@@=                                               ",
  "                                      ..#@@@@@@@@@@@- .                                             ",

];

const DENSITY_SCALE = " .:-=+*#%@";

export default function TorchStem() {
  return (
    <pre className="torch-stem">
      {STEM_ART.map((line, i) => (
        <div key={i} className="stem-row">
          {line.split("").map((ch, idx) => {
            if (ch === " ") return <span key={idx}> </span>;
            const density = DENSITY_SCALE.indexOf(ch);
            const v = density >= 0 ? density / (DENSITY_SCALE.length - 1) : 0.3;
            const foregroundWeight = Math.round(32 + v * 56);
            return (
              <span
                key={idx}
                className="stem-char"
                style={{ ["--stem-foreground-weight" as "--stem-foreground-weight"]: `${foregroundWeight}%` } as React.CSSProperties}
              >
                {ch}
              </span>
            );
          })}
        </div>
      ))}
      <style>{`
        .torch-stem {
          font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
          font-size: clamp(6px, 1.1vw, 12px);
          line-height: 1.15;
          letter-spacing: 0.02em;
          margin: 0;
          padding: 0;
          white-space: pre;
          filter: contrast(1.08);
          transition: filter 0.2s ease;
        }
        .stem-row {
          display: block;
          line-height: 1.15;
        }
        .stem-char {
          color: var(--foreground);
          color: color-mix(in srgb, var(--foreground) var(--stem-foreground-weight), var(--background));
        }

        @media (prefers-contrast: more) {
          .torch-stem {
            filter: contrast(1.45) brightness(1.08);
          }
        }
      `}</style>
    </pre>
  );
}
