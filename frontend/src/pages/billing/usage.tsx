import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import { TopBar } from "@/components/topbar";
import { handleLogout, handleLogoutAll } from "@/lib/logout";
import { Panel, Meter, Tabs, TabPanel } from "@/components/ui";

const usd = (cents: number) =>
  `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const plural = (n: number, one: string, many?: string) => `${n} ${n === 1 ? one : (many || one + 's')}`;

// Current plan structures from billing.js
const PLANS = {
  developer: [
    { code: 'dev_builder', name: 'Builder', ram: 0.5, cpu: 0.25, bw: 10 },
    { code: 'dev_pro', name: 'Pro', ram: 2, cpu: 1, bw: 50 },
    { code: 'dev_team', name: 'Team', ram: 6, cpu: 3, bw: 200 },
  ],
  business: [
    { code: 'biz_essentials', name: 'Essentials Care', ram: 0.25, cpu: 0.25, bw: 0 },
    { code: 'biz_care', name: 'Business Care', ram: 1, cpu: 1, bw: 0 },
    { code: 'biz_managed', name: 'Managed Platform', ram: 4, cpu: 2, bw: 0 },
  ],
};

const RATES = { ram: 10, cpu: 13, bw: 0.05 }; // $ per GB-month / vCPU-month / GB

export default function UsagePage() {
  const router = useRouter();
  const [plan, setPlan] = useState('dev_pro');
  const [typical, setTypical] = useState(1.4);
  const [days, setDays] = useState(1);
  const [size, setSize] = useState(3);
  const [cpu, setCpu] = useState(0.8);
  const [bw, setBw] = useState(6);
  const [env, setEnv] = useState<('dev' | 'biz')>('dev');

  // Calculate monthly average with spike
  const monthlyAverage = useMemo(() => {
    if (days === 0) return typical;
    const spikeTotal = days * size;
    const normalDays = 30 - days;
    const normalTotal = normalDays * typical;
    return (spikeTotal + normalTotal) / 30;
  }, [typical, days, size]);

  const currentPlan = useMemo(() => {
    const plans = env === 'dev' ? PLANS.developer : PLANS.business;
    return plans.find(p => p.code === plan) || plans[0];
  }, [plan, env]);

  const overage = useMemo(() => {
    const ramOver = Math.max(0, monthlyAverage - currentPlan.ram);
    const cpuOver = Math.max(0, cpu - currentPlan.cpu);
    const bwOver = Math.max(0, bw - currentPlan.bw);
    return {
      ram: ramOver * RATES.ram,
      cpu: cpuOver * RATES.cpu,
      bw: bwOver * RATES.bw,
      total: ramOver * RATES.ram + cpuOver * RATES.cpu + bwOver * RATES.bw
    };
  }, [monthlyAverage, cpu, bw, currentPlan]);

  const handleEnvChange = (newEnv: 'dev' | 'biz') => {
    setEnv(newEnv);
    // Reset to appropriate default plan
    const defaultPlan = newEnv === 'dev' ? 'dev_builder' : 'biz_essentials';
    setPlan(defaultPlan);
  };

  return (
    <div className="relative min-h-screen bg-page text-foreground">
      <TopBar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />

      <main className="p-4 sm:p-6 lg:p-8 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-brand mb-2">How Usage is Billed</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            A small base per environment, then only what you use above it. 
            Move the knobs to see how a busy week changes the month.
            Prices are on the <a href="https://artisanhosting.net/run/pricing.html" className="text-brand hover:underline">pricing page</a>.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <Panel title="Your usage">
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium mb-2">Product</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`flex-1 py-2 px-3 rounded border ${env === 'dev' ? 'bg-brand text-white border-brand' : ''}`}
                        onClick={() => handleEnvChange('dev')}
                      >
                        Developer
                      </button>
                      <button
                        type="button"
                        className={`flex-1 py-2 px-3 rounded border ${env === 'biz' ? 'bg-brand text-white border-brand' : ''}`}
                        onClick={() => handleEnvChange('biz')}
                      >
                        Business
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Plan</label>
                    <select
                      className="field"
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                    >
                      {(env === 'dev' ? PLANS.developer : PLANS.business).map((p) => (
                        <option key={p.code} value={p.code}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium">Typical memory use</label>
                    <span className="text-sm font-mono">{typical.toFixed(1)} GB</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="4"
                    step="0.1"
                    value={typical}
                    onChange={(e) => setTypical(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>What your project uses on an ordinary day.</p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium">Traffic spike</label>
                    <span className="text-sm font-mono">{plural(days, 'day')}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`py-1 px-3 rounded border ${days === 0 ? 'bg-brand text-white border-brand' : ''}`}
                      onClick={() => setDays(0)}
                    >
                      None
                    </button>
                    {[1, 2, 3, 4, 5].map((d) => (
                      <button
                        key={d}
                        type="button"
                        className={`py-1 px-3 rounded border ${days === d ? 'bg-brand text-white border-brand' : ''}`}
                        onClick={() => setDays(d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>A launch, a mention, or a bad crawler.</p>
                </div>

                {days > 0 && (
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium">Spike size</label>
                      <span className="text-sm font-mono">{size.toFixed(1)} GB</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="8"
                      step="0.5"
                      value={size}
                      onChange={(e) => setSize(parseFloat(e.target.value))}
                      className="w-full"
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>How much memory you use on a spike day.</p>
                  </div>
                )}

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium">Processor (average)</label>
                    <span className="text-sm font-mono">{cpu.toFixed(1)} vCPU</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="4"
                    step="0.1"
                    value={cpu}
                    onChange={(e) => setCpu(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium">Traffic this month</label>
                    <span className="text-sm font-mono">{bw} GB</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={bw}
                    onChange={(e) => setBw(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </Panel>
          </div>

          <div>
            <Panel title="Your monthly estimate">
              <div className="text-4xl font-semibold mb-4" style={{ color: 'var(--strong)' }}>
                {usd((monthlyAverage <= currentPlan.ram ? 0 : (monthlyAverage - currentPlan.ram) * RATES.ram) +
                     (cpu <= currentPlan.cpu ? 0 : (cpu - currentPlan.cpu) * RATES.cpu) +
                     (bw <= currentPlan.bw ? 0 : (bw - currentPlan.bw) * RATES.bw) * 100)}
              </div>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                <strong>{currentPlan.name} plan:</strong> {usd(0)} included (base plan fee not shown)
              </p>
            </Panel>

            <div className="space-y-4 mt-4">
              <Meter
                label="Memory (monthly avg)"
                value={monthlyAverage}
                valueLabel={`${monthlyAverage.toFixed(1)} GB`}
                included={currentPlan.ram}
                includedLabel={`${currentPlan.ram} GB included`}
                capNote={monthlyAverage > currentPlan.ram 
                  ? `${(monthlyAverage - currentPlan.ram).toFixed(1)} GB above included`
                  : undefined
                }
              />
              
              <Meter
                label="Processor (average)"
                value={cpu}
                valueLabel={`${cpu.toFixed(1)} vCPU`}
                included={currentPlan.cpu}
                includedLabel={`${currentPlan.cpu} vCPU included`}
                capNote={cpu > currentPlan.cpu 
                  ? `${(cpu - currentPlan.cpu).toFixed(1)} vCPU above included`
                  : undefined
                }
              />

              {currentPlan.bw && (
                <Meter
                  label="Traffic (this month)"
                  value={bw}
                  valueLabel={`${bw} GB`}
                  included={currentPlan.bw}
                  includedLabel={`${currentPlan.bw} GB included`}
                  capNote={bw > currentPlan.bw 
                    ? `${bw - currentPlan.bw} GB above included`
                    : undefined
                  }
                />
              )}
            </div>

            <Panel title="What this means" className="mt-4">
              <div className="space-y-3 text-sm">
                {monthlyAverage <= currentPlan.ram && cpu <= currentPlan.cpu && bw <= (currentPlan.bw || 0) && (
                  <p style={{ color: 'var(--muted)' }}>
                    Your usage is within your plan's allowances. You only pay the base plan fee.
                  </p>
                )}
                {monthlyAverage > currentPlan.ram && (
                  <p>
                    <span style={{ color: 'var(--strong)' }}>Memory overage:</span> 
                    {(monthlyAverage - currentPlan.ram).toFixed(1)} GB × ${RATES.ram}/GB = 
                    <span className="font-mono"> ${((monthlyAverage - currentPlan.ram) * RATES.ram).toFixed(2)}/mo</span>
                  </p>
                )}
                {cpu > currentPlan.cpu && (
                  <p>
                    <span style={{ color: 'var(--strong)' }}>CPU overage:</span> 
                    {cpu - currentPlan.cpu} vCPU × ${RATES.cpu}/vCPU = 
                    <span className="font-mono"> ${(cpu - currentPlan.cpu) * RATES.cpu}/mo</span>
                  </p>
                )}
                {bw > (currentPlan.bw || 0) && (
                  <p>
                    <span style={{ color: 'var(--strong)' }}>Bandwidth overage:</span> 
                    {bw - currentPlan.bw} GB × ${RATES.bw}/GB = 
                    <span className="font-mono"> ${(bw - currentPlan.bw) * RATES.bw}/mo</span>
                  </p>
                )}
              </div>
            </Panel>

            <Panel title="How billing works" className="mt-4">
              <ol className="space-y-3 text-sm" style={{ color: 'var(--muted)' }}>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center text-sm font-medium">1</span>
                  <span>We record it every day — Memory, processor and traffic, for each of your projects.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center text-sm font-medium">2</span>
                  <span>We average the month — A busy hour or a single bad day barely moves an average.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand text-white flex items-center justify-center text-sm font-medium">3</span>
                  <span>You pay for what is above your plan — Anything at or below what your plan includes costs nothing extra.</span>
                </li>
              </ol>
            </Panel>
          </div>
        </div>

        <div className="card p-6 mt-6">
          <h2 className="text-xl font-semibold text-brand mb-4">What does it cost to leave?</h2>
          <div className="border-t pt-4">
            <p className="font-medium" style={{ color: 'var(--strong)' }}>
              Nothing.
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
              You own your domain, your code and your content.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
