// src/components/Dashboard.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import { fetchRunners, fetchGroupUsage } from "@/lib/api";
import { UsageSummary } from "@/lib/types";
import { Sidebar } from "@/components/header";
import LoadingOverlay from "@/components/loading";
import { handleLogout, handleLogoutAll } from "@/lib/logout";
import { resolveRunnerLabel } from "@/lib/repoLabel";

const REFRESH_INTERVAL = 10_000; // 10s

interface RunnerCard {
  name: string;
  status: string;
  summary?: UsageSummary;
}

export default function Dashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("Loading...");
  const [runners, setRunners] = useState<RunnerCard[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const loading = false;
  // const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);

  const loadData = useCallback(async () => {
    // Skip this tick if the previous poll is still running, so a slow
    // upstream can't pile up overlapping batches of requests.
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const list = await fetchRunners();

      const results = await Promise.allSettled(
        list.map(async (r): Promise<RunnerCard> => {
          const name = r.name.replace("ais_", "");
          const summary = await fetchGroupUsage(name);
          return { name, status: r.status, summary };
        })
      );

      const cards: RunnerCard[] = results
        .filter((r): r is PromiseFulfilledResult<RunnerCard> => r.status === "fulfilled")
        .map((r) => r.value);

      setRunners(cards);
    } catch (err) {
      console.error("Dashboard load error", err);
    } finally {
      inFlight.current = false;
    }
  }, [router]);

  useEffect(() => {
    loadData();

    // optional: refresh every REFRESH_INTERVAL if you want
    const iv = setInterval(loadData, REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [loadData]);

  useEffect(() => {
    let cancelled = false;
    runners.forEach((r) => {
      if (labels[r.name]) return;
      resolveRunnerLabel(r.name).then((label) => {
        if (cancelled) return;
        setLabels((prev) => (prev[r.name] ? prev : { ...prev, [r.name]: label }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [runners]);

  return (
    <div className="relative min-h-screen flex bg-page text-foreground">
      {/* Sidebar should be a sibling of <main>, not a child */}
      <Sidebar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />

      {/* Content area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <h2 className="text-2xl font-semibold mb-8 text-brand">
          Current Projects
        </h2>

        {!loading && (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {runners.map((r) => (
              <div
                key={r.name}
                className="card-hover p-6"
              >
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-xl font-semibold text-brand">
                      {labels[r.name] ?? r.name}
                    </p>
                    <p
                      className={`text-sm mt-1 ${
                        r.status === "Running"
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {r.status}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/apps/${r.name}`)}
                    className="btn-brand px-4 py-2 rounded-full text-sm font-medium"
                  >
                    Details →
                  </button>
                </div>

                {r.summary && (
                  <div className="text-sm text-gray-300 space-y-1 mb-4">
                    <p>
                      Total CPU Time:{" "}
                      <span className="font-medium text-white">
                        {r.summary.total_cpu.toFixed(2)}
                      </span>{" "}
                      hrs
                    </p>
                    <p>
                      Avg RAM:{" "}
                      <span className="font-medium text-white">
                        {r.summary.avg_memory.toFixed(2)}
                      </span>{" "}
                      MB
                    </p>
                    <p>
                      Peak RAM:{" "}
                      <span className="font-medium text-white">
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
