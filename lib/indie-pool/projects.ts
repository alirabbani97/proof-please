/**
 * Project types + helpers.
 *
 * Projects are now real on-chain `Project` accounts (see `client.ts`
 * `listProjects`). The `DEMO_SEED` array below is used by the
 * `scripts/seed-projects.ts` one-shot script to populate devnet with
 * the same demo set the static list used to hardcode — so the dApp
 * lands on a populated /projects page even on first run.
 *
 * The `Project` shape here is the UI's "rich" view: on-chain fields
 * plus a few derived defaults (escrow balance, contributor count, etc.).
 * Use `projectFromOnChain()` to translate.
 */
import type { ContributionType, ProjectEscrowState } from "./types";
import type { OnChainProject } from "./client";

const LAMPORTS_PER_SOL = 1_000_000_000;

export interface Project {
  /** PDA pubkey of the on-chain Project account. */
  id: string;
  /** URL-safe slug + on-chain seed. */
  slug: string;
  name: string;
  /** One-line pitch shown on the card. Maps to on-chain `blurb`. */
  description: string;
  /** Drives the type badge color and the project art generator. */
  primaryType: ContributionType;
  /** Emoji or single-char visual marker; empty → procedural art. */
  art: string;
  /** Base58 creator wallet from on-chain. */
  creator: string;
  /** Live escrow balance in SOL (0 when no escrow funded). */
  escrowSol: number;
  /** Contributors who have submitted (computed off-chain or 0). */
  contributorCount: number;
  /** Minimum reputation score required to submit (UI default). */
  minScoreThreshold: number;
  /** total_released / total_funded from chain, 0–1. */
  milestoneProgress: number;
  /** Studio name; defaults to "Indie Pool" when not tracked. */
  studio: string;
  /** ISO date string from on-chain `created_at`. */
  postedAt: string;
}

/**
 * Type → color CSS variable name. Used for badges, art accents,
 * and progress bars on /projects. Pink + amber are added to the
 * theme in globals.css to support this mapping.
 */
export const TYPE_COLOR: Record<ContributionType, string> = {
  code: "rep-cyan",
  art: "rep-purple",
  "3d": "rep-purple",
  music: "rep-pink",
  writing: "rep-amber",
  testing: "rep-success",
};

/**
 * Filter UI groups Art + 3D into one option per the design brief.
 * The filter logic in /projects expands "art" to also match "3d".
 */
export type ProjectTypeFilter =
  | "all"
  | "code"
  | "art-3d"
  | "music"
  | "writing"
  | "testing";

export const TYPE_FILTERS: { value: ProjectTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "code", label: "Code" },
  { value: "art-3d", label: "Art / 3D" },
  { value: "music", label: "Music" },
  { value: "writing", label: "Writing" },
  { value: "testing", label: "Testing" },
];

export function projectMatchesTypeFilter(
  p: Project,
  filter: ProjectTypeFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "art-3d") return p.primaryType === "art" || p.primaryType === "3d";
  return p.primaryType === filter;
}

export type SortKey = "newest" | "highest_reward" | "most_contributors";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "highest_reward", label: "Highest Reward" },
  { value: "most_contributors", label: "Most Contributors" },
];

export function sortProjects(projects: Project[], by: SortKey): Project[] {
  const sorted = [...projects];
  switch (by) {
    case "newest":
      return sorted.sort(
        (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
      );
    case "highest_reward":
      return sorted.sort((a, b) => b.escrowSol - a.escrowSol);
    case "most_contributors":
      return sorted.sort((a, b) => b.contributorCount - a.contributorCount);
  }
}

/**
 * Translates an on-chain Project + (optional) escrow into the UI's
 * "rich" Project view used by ProjectCard and friends. UI fields that
 * don't exist on-chain (studio, minScoreThreshold) get sensible defaults;
 * fields that do (escrowSol, milestoneProgress) come from the live escrow.
 */
export function projectFromOnChain(
  oc: OnChainProject,
  escrow?: ProjectEscrowState | null,
): Project {
  const escrowSol = escrow ? escrow.balanceLamports / LAMPORTS_PER_SOL : 0;
  const funded = escrow ? escrow.totalFunded : 0;
  const released = escrow ? escrow.totalReleased : 0;
  return {
    id: oc.pubkey,
    slug: oc.projectId,
    name: oc.name,
    description: oc.blurb,
    primaryType: oc.primaryType,
    art: oc.art,
    creator: oc.creator,
    escrowSol,
    contributorCount: 0, // computed elsewhere if needed
    minScoreThreshold: 60,
    milestoneProgress: funded > 0 ? released / funded : 0,
    studio: "Indie Pool",
    postedAt: new Date(oc.createdAt * 1000).toISOString(),
  };
}

/**
 * Demo seed data — used by scripts/seed-projects.ts to register the same
 * 9 demo projects on devnet that the old static list used to render
 * locally. Run `pnpm exec tsx scripts/seed-projects.ts` to populate.
 */
export interface DemoSeed {
  slug: string;
  name: string;
  blurb: string;
  art: string;
  primaryType: ContributionType;
}

export const DEMO_SEED: DemoSeed[] = [
  {
    slug: "pixel-forge-rpg",
    name: "Pixel Forge RPG",
    blurb:
      "Top-down dungeon crawler with procedural biomes and hand-drawn pixel art.",
    art: "🎨",
    primaryType: "art",
  },
  {
    slug: "subterranean",
    name: "Subterranean",
    blurb:
      "Atmospheric horror in an abandoned arcology. Looking for ambient soundscape composers.",
    art: "🌑",
    primaryType: "music",
  },
  {
    slug: "echoes-of-atlantis",
    name: "Echoes of Atlantis",
    blurb:
      "Underwater exploration RPG. Need writers for environmental storytelling and dialogue.",
    art: "🌊",
    primaryType: "writing",
  },
  {
    slug: "solar-flare-shaders",
    name: "Solar Flare Shaders",
    blurb:
      "Open-source GLSL shader pack for sci-fi indies. Plasma, parallax stars, holographic UI.",
    art: "☀️",
    primaryType: "code",
  },
  {
    slug: "cyberpunk-cube",
    name: "Cyberpunk Cube",
    blurb:
      "Modular 3D environment kit. Buildings, signage, neon clutter for cyberpunk indies.",
    art: "🟪",
    primaryType: "3d",
  },
  {
    slug: "bug-hunters-anonymous",
    name: "Bug Hunters Anonymous",
    blurb:
      "Pre-launch QA pool for an upcoming roguelike. Reproducible bug reports earn rewards.",
    art: "🐛",
    primaryType: "testing",
  },
  {
    slug: "neon-brawler",
    name: "Neon Brawler",
    blurb:
      "1v1 fighting game with combo trees driven by behavior-tree AI. Combat AI engineers wanted.",
    art: "⚡",
    primaryType: "code",
  },
  {
    slug: "twilight-atelier",
    name: "Twilight Atelier",
    blurb:
      "Otome visual novel set in 1920s Paris. Character portraits and CG illustration commissions.",
    art: "🌹",
    primaryType: "art",
  },
  {
    slug: "lullabies-for-the-void",
    name: "Lullabies for the Void",
    blurb:
      "Cosmic horror walking sim. Looking for orchestral and choral compositions for key scenes.",
    art: "🎼",
    primaryType: "music",
  },
];
