/**
 * Circular progress ring for a 0-100 score.
 * Used on Pending → Verified transitions and on the Dashboard.
 */

import { APPROVAL_THRESHOLD } from "@/lib/indie-pool/types";

export function ScoreRing({
  score,
  size = 128,
  label = "score",
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const dash = (clamped / 100) * circ;
  const colorClass =
    score >= 80
      ? "text-rep-success"
      : score >= APPROVAL_THRESHOLD
      ? "text-rep-cyan"
      : "text-rep-danger";

  return (
    <div
      className="relative inline-flex shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={stroke}
          fill="none"
          className="text-rep-fg"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className={`${colorClass} transition-[stroke-dasharray] duration-700`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className={`text-4xl font-semibold ${colorClass}`}>
            {Math.round(score)}
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-rep-muted mt-0.5">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
