"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Nav } from "@/components/nav";
import { ProjectCard } from "@/components/project-card";
import { ProjectsFilterBar } from "@/components/projects-filter-bar";
import { SubmitSlideover } from "@/components/submit-slideover";
import { FundEscrowModal } from "@/components/fund-escrow-modal";
import { RegisterProjectModal } from "@/components/register-project-modal";
import { listEscrows, listProjects } from "@/lib/indie-pool/client";
import type { OnChainProject } from "@/lib/indie-pool/client";
import type { ProjectEscrowState } from "@/lib/indie-pool/types";
import {
  projectFromOnChain,
  projectMatchesTypeFilter,
  sortProjects,
  type Project,
  type ProjectTypeFilter,
  type SortKey,
} from "@/lib/indie-pool/projects";

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProjectTypeFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [fundingProject, setFundingProject] = useState<Project | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const [onChainProjects, setOnChainProjects] = useState<OnChainProject[]>([]);
  const [escrowsByProject, setEscrowsByProject] = useState<
    Record<string, ProjectEscrowState | undefined>
  >({});
  const [loaded, setLoaded] = useState(false);
  const { connection } = useConnection();

  const refresh = useCallback(async () => {
    const [projects, escrows] = await Promise.all([
      listProjects({ connection }),
      listEscrows({ connection }),
    ]);
    const escrowMap: Record<string, ProjectEscrowState> = {};
    for (const e of escrows) escrowMap[e.projectId] = e;
    setOnChainProjects(projects);
    setEscrowsByProject(escrowMap);
    setLoaded(true);
  }, [connection]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Translate on-chain → UI Project (join with escrow when available).
  const allProjects: Project[] = useMemo(
    () =>
      onChainProjects.map((oc) =>
        projectFromOnChain(oc, escrowsByProject[oc.projectId] ?? null),
      ),
    [onChainProjects, escrowsByProject],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = allProjects.filter((p) => {
      if (!projectMatchesTypeFilter(p, typeFilter)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.studio.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    });
    return sortProjects(list, sortBy);
  }, [allProjects, search, typeFilter, sortBy]);

  return (
    <main className="flex flex-1 flex-col">
      <Nav />

      <section className="flex-1 px-4 sm:px-6 py-10 sm:py-14">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Page header */}
          <header className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-rep-cyan">
              projects · on-chain registry
            </p>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                  Browse open contributions
                </h1>
                <p className="text-sm text-rep-muted max-w-md leading-relaxed mt-3">
                  Every project below is a real on-chain{" "}
                  <code className="font-mono text-rep-fg">Project</code>{" "}
                  account. Anyone can register a new one — your slug becomes
                  the PDA seed.
                </p>
              </div>
              <button
                onClick={() => setRegisterOpen(true)}
                className="self-start sm:self-end px-4 py-2.5 border border-rep-cyan/40 text-rep-cyan hover:bg-rep-cyan/10 text-sm font-mono uppercase tracking-[0.15em] transition-colors"
              >
                + Register project
              </button>
            </div>
          </header>

          {/* Filter bar */}
          <ProjectsFilterBar
            search={search}
            setSearch={setSearch}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            resultCount={filtered.length}
            totalCount={allProjects.length}
          />

          {/* Grid */}
          {!loaded ? (
            <LoadingState />
          ) : filtered.length === 0 ? (
            allProjects.length === 0 ? (
              <FirstRunEmpty onRegister={() => setRegisterOpen(true)} />
            ) : (
              <NoMatchesEmpty
                onReset={() => {
                  setSearch("");
                  setTypeFilter("all");
                }}
              />
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  escrow={escrowsByProject[project.slug] ?? null}
                  onSubmit={setActiveProject}
                  onFund={setFundingProject}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <SubmitSlideover
        key={activeProject?.id ?? "closed"}
        project={activeProject}
        onClose={() => setActiveProject(null)}
      />

      {fundingProject && (
        <FundEscrowModal
          key={fundingProject.id}
          projectId={fundingProject.slug}
          projectName={fundingProject.name}
          existing={escrowsByProject[fundingProject.slug] ?? null}
          onClose={() => setFundingProject(null)}
          onSuccess={() => {
            void refresh();
          }}
        />
      )}

      {registerOpen && (
        <RegisterProjectModal
          onClose={() => setRegisterOpen(false)}
          onSuccess={() => {
            void refresh();
          }}
        />
      )}
    </main>
  );
}

function LoadingState() {
  return (
    <div className="border border-dashed border-white/10 bg-rep-card/30 px-6 py-14 text-center">
      <p className="text-sm text-rep-muted">Loading on-chain projects…</p>
    </div>
  );
}

function FirstRunEmpty({ onRegister }: { onRegister: () => void }) {
  return (
    <div className="border border-dashed border-white/10 bg-rep-card/30 px-6 py-14 text-center space-y-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-rep-muted">
        no projects yet
      </p>
      <h3 className="text-base font-medium">
        No projects have been registered on this program.
      </h3>
      <p className="text-sm text-rep-muted max-w-sm mx-auto leading-relaxed">
        Be the first — register a project to start accepting contributions
        and (optionally) fund an escrow.
      </p>
      <button
        onClick={onRegister}
        className="mt-2 px-4 py-2 border border-rep-cyan/40 text-rep-cyan hover:bg-rep-cyan/10 text-sm transition-colors"
      >
        Register the first project
      </button>
    </div>
  );
}

function NoMatchesEmpty({ onReset }: { onReset: () => void }) {
  return (
    <div className="border border-dashed border-white/10 bg-rep-card/30 px-6 py-14 text-center space-y-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-rep-muted">
        no matches
      </p>
      <h3 className="text-base font-medium">
        No projects match your filters
      </h3>
      <p className="text-sm text-rep-muted max-w-sm mx-auto leading-relaxed">
        Try widening the type filter or clearing the search query.
      </p>
      <button
        onClick={onReset}
        className="mt-2 px-4 py-2 border border-white/15 hover:border-rep-fg text-sm transition-colors"
      >
        Reset filters
      </button>
    </div>
  );
}
