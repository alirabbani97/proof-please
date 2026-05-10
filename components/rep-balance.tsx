/**
 * Big REP balance display for the dashboard hero.
 */

export function RepBalance({
  amount,
  contributionCount,
}: {
  amount: number;
  contributionCount: number;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 sm:p-8 rounded-2xl border border-rep-cyan/20 bg-gradient-to-br from-rep-cyan/8 via-rep-card/40 to-rep-purple/10">
      <div className="size-24 rounded-2xl bg-gradient-to-br from-rep-cyan/30 to-rep-purple/30 border border-rep-cyan/20 grid place-items-center">
        <div className="text-center">
          <div className="text-3xl font-semibold text-rep-cyan font-mono">
            {amount}
          </div>
          <div className="text-[9px] uppercase tracking-[0.2em] font-mono text-rep-muted">
            rep
          </div>
        </div>
      </div>
      <div className="flex-1">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-rep-muted mb-2">
          total reputation
        </p>
        <p className="text-3xl sm:text-4xl font-semibold tracking-tight">
          {amount} <span className="text-rep-cyan">REP</span>
        </p>
        <p className="text-sm text-rep-muted mt-2">
          across {contributionCount} contribution
          {contributionCount === 1 ? "" : "s"} · non-transferable · token-2022
        </p>
      </div>
    </div>
  );
}
