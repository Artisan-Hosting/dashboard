// src/components/Dashboard.tsx
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { fetchWithAuth } from "@/lib/api";
import {
  RunnerSummary,
  UsageSummary,
  Metrics,
} from "@/lib/types";
import { Sidebar } from "@/components/header";
import LoadingOverlay from "@/components/loading";
import { handleLogout, handleLogoutAll } from "@/lib/logout";

const REFRESH_INTERVAL = 10_000; // 10s

interface RunnerCard {
  name: string;
  status: string;
  live?: Metrics;
  summary?: UsageSummary;
}

export default function Dashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("Loading...");
  const [runners, setRunners] = useState<RunnerCard[]>([]);
  const loading = false;
  // const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    // setLoading(true);
    try {
      const res = await fetchWithAuth("proxy/runners");
      const list: RunnerSummary[] = res.data || [];

      const cards: RunnerCard[] = await Promise.all(
        list.map(async (r) => {
          const name = r.name.replace("ais_", "");
          const sumRes = await fetchWithAuth(
            `proxy/usage/group/${name}`
          );
          return {
            name,
            status: r.status,
            live: r.metrics,
            summary: sumRes.data as UsageSummary,
          };
        })
      );

      setRunners(cards);
    } catch (err) {
      console.error("Dashboard load error", err);
    } finally {
      // setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();

    // optional: refresh every REFRESH_INTERVAL if you want
    const iv = setInterval(loadData, REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [loadData]);

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
                      {r.name}
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
                    className="bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-full text-sm font-medium"
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

                <div className="h-28 bg-gradient-to-r from-[color:var(--gradient-start)]/20 to-[color:var(--gradient-end)]/40 rounded-lg flex items-center justify-center text-sm italic text-gray-400">
                  [Realtime graph coming soon]
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      {loading && <LoadingOverlay />}
    </div>
  );
}
