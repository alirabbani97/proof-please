import type { Contribution } from "@/lib/indie-pool/types";
import { CONTRIBUTION_TYPES } from "@/lib/indie-pool/types";
import { TruncatedKey } from "./truncate-key";

const STATUS_STYLES: Record<Contribution["status"], string> = {
  Pending: "text-rep-muted bg-white/5 border-white/10",
  Verified: "text-rep-success bg-rep-success/10 border-rep-success/20",
  Rejected: "text-rep-danger bg-rep-danger/10 border-rep-danger/20",
};

export function ContributionCard({ c }: { c: Contribution }) {
  const typeMeta = CONTRIBUTION_TYPES.find((t) => t.value === c.contributionType);
  const date = new Date(c.submittedAt * 1000);
  return (
    <article className="border border-white/5 rounded-xl p-5 bg-rep-card/40 hover:bg-rep-card/60 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-gradient-to-br from-rep-purple/30 to-rep-cyan/20 grid place-items-center text-lg font-mono">
            {typeMeta?.icon ?? "?"}
          </div>
          <div>
            <p className="font-medium text-sm">{c.projectId}</p>
            <p className="font-mono text-xs text-rep-muted">
              {typeMeta?.label ?? c.contributionType} ·{" "}
              {date.toLocaleDateString()}{" "}
              {date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`font-mono text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded border ${STATUS_STYLES[c.status]}`}
          >
            {c.status}
          </span>
          {c.status === "Verified" && (
            <span className="text-xl font-semibold text-rep-cyan font-mono leading-none">
              {c.score}
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-rep-muted mt-3 line-clamp-2 leading-relaxed">
        {c.description}
      </p>

      {c.reasoning && (
        <p className="text-xs text-rep-muted/80 mt-2 italic line-clamp-2">
          “{c.reasoning}”
        </p>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 text-xs">
        <div className="flex items-center gap-4 font-mono">
          <span className="text-rep-muted">PDA</span>
          <TruncatedKey pubkey={c.pubkey} />
        </div>
        {c.status === "Verified" && c.minted && (
          <span className="text-rep-success font-mono">+{c.score} REP</span>
        )}
      </div>
    </article>
  );
}
