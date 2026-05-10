/**
 * Truncated wallet/PDA pubkey display.
 * Spec §3.6: "Wallet addresses always visible in truncated form: 0x1234...ABCD"
 */

export function truncateKey(key: string | undefined | null, head = 4, tail = 4): string {
  if (!key) return "";
  if (key.length <= head + tail + 1) return key;
  return `${key.slice(0, head)}…${key.slice(-tail)}`;
}

export function TruncatedKey({
  pubkey,
  className = "",
  head,
  tail,
}: {
  pubkey: string;
  className?: string;
  head?: number;
  tail?: number;
}) {
  return (
    <span
      className={`font-mono text-rep-muted ${className}`}
      title={pubkey}
    >
      {truncateKey(pubkey, head, tail)}
    </span>
  );
}
