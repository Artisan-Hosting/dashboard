import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { fetchProjects, fetchGroupUsage } from "@/lib/api";
import { UsageSummary } from "@/lib/types";
import { TopBar } from "@/components/topbar";
import LoadingOverlay from "@/components/loading";
import { handleLogout, handleLogoutAll } from "@/lib/logout";
import { resolveRunnerLabel } from "@/lib/repoLabel";
import { Button, Pill } from "@/components/ui";
import { AddressView, fetchAddresses } from "@/lib/address";

const REFRESH_INTERVAL = 10_000; // 10s
const ADDRESS_INTERVAL = 30_000;

interface ProjectCard {
  name: string;
  status: string;
  summary?: UsageSummary;
}

export default function Dashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("Loading...");
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [addresses, setAddresses] = useState<Record<string, AddressView[]>>({});
  const [loading, setLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const loadData = useCallback(async () => {
    // Skip this tick if the previous poll is still running, so a slow
    // upstream can't pile up overlapping batches of requests.
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const list = await fetchProjects();

      const results = await Promise.allSettled(
        list.map(async (r): Promise<ProjectCard> => {
          const name = r.name.replace("ais_", "");
          const summary = await fetchGroupUsage(name);
          return { name, status: r.status, summary };
        })
      );

      // Keep every project even when its usage fetch failed -- a project that
      // exists but has no usage stats right now should still show as a card
      // (just without the usage block), not vanish entirely.
      const cards: ProjectCard[] = results.map((r, i) =>
        r.status === "fulfilled" ? r.value : { name: list[i].name.replace("ais_", ""), status: list[i].status }
      );

      setProjects(cards);
      setProjectsError(null);
    } catch (err) {
      console.error("Dashboard load error", err);
      setProjectsError(err instanceof Error ? err.message : "Failed to load apps");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();

    // optional: refresh every REFRESH_INTERVAL if you want
    const iv = setInterval(loadData, REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [loadData]);

  // The live column. Slower than the status poll because Portal asks the node about each app.
  const names = projects.map((p) => p.name).join(",");
  useEffect(() => {
    let cancelled = false;
    const read = () =>
      names.split(",").filter(Boolean).forEach((name) =>
        fetchAddresses(name)
          .then((l) => !cancelled && setAddresses((prev) => ({ ...prev, [name]: l.addresses })))
          .catch(() => {})
      );
    read();
    const iv = setInterval(read, ADDRESS_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [names]);

  useEffect(() => {
    let cancelled = false;
    projects.forEach((r) => {
      if (labels[r.name]) return;
      resolveRunnerLabel(r.name).then((label) => {
        if (cancelled) return;
        setLabels((prev) => (prev[r.name] ? prev : { ...prev, [r.name]: label }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [projects]);

  return (
    <div className="relative min-h-screen bg-page text-foreground">
      <TopBar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />

      <main className="p-4 sm:p-6 lg:p-8">
        <h2 className="text-2xl font-semibold mb-8 text-brand">
          Current Projects
        </h2>

        {projectsError && <p className="note bad mb-4">{projectsError}</p>}

        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="muted mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="mb-2">No apps found</h3>
            <p className="muted max-w-md">
              You don't have any apps deployed yet. Apps will appear here once they're created.
            </p>
            <div className="mt-4">
              <Button onClick={() => router.push("/projects/new")}>Add a repository</Button>
            </div>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((r) => (
              <div
                key={r.name}
                className="card-hover p-6"
              >
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-xl font-semibold text-brand">
                      {labels[r.name] ?? r.name}
                    </p>
                    <div className="mt-1">
                      <Pill status={r.status} />
                    </div>
                  </div>
                  <Button small onClick={() => router.push(`/apps/${r.name}`)}>
                    Details →
                  </Button>
                </div>

                <div className="mb-4 text-sm">
                  {(addresses[r.name] ?? []).length === 0 ? (
                    <Link href={`/apps/${r.name}`} className="muted">No address yet. Give it one.</Link>
                  ) : (
                    (addresses[r.name] ?? []).map((a) => (
                      <p key={a.fqdn} className="flex items-center gap-2">
                        <span className="mono">{a.fqdn}</span>
                        <span className="pill" data-s={a.state === "live" ? "live" : a.state === "failed" || a.state === "app_down" ? "failed" : "waiting"}>{a.state === "live" ? "Live" : a.state === "app_down" ? "App not answering" : a.state === "failed" ? "Needs attention" : "Setting up"}</span>
                      </p>
                    ))
                  )}
                </div>

                {r.summary && (
                  <div className="text-sm space-y-1 mb-4" style={{ color: 'var(--muted)' }}>
                    <p>
                      Total CPU Time:{" "}
                      <span className="font-medium" style={{ color: 'var(--strong)' }}>
                        {r.summary.total_cpu.toFixed(2)}
                      </span>{" "}
                      hrs
                    </p>
                    <p>
                      Avg RAM:{" "}
                      <span className="font-medium" style={{ color: 'var(--strong)' }}>
                        {r.summary.avg_memory.toFixed(2)}
                      </span>{" "}
                      MB
                    </p>
                    <p>
                      Peak RAM:{" "}
                      <span className="font-medium" style={{ color: 'var(--strong)' }}>
                        {r.summary.peak_memory.toFixed(2)}
                      </span>{" "}
                      MB
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      {loading && <LoadingOverlay />}
    </div>
  );
}
