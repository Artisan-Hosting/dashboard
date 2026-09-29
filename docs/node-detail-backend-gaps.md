# Node detail page — backend gaps

Written while enriching the dashboard's `/nodes/[id]` page with data from `Portal`
and `ais_manager`. Everything below was verified by reading source in both repos
(`artisan-hosting/portal` @ `e93124d`, `artisan-hosting/ais_manager` @ `7bb5291`)
against two real API responses, not guessed. It's a handoff for whoever owns
those two repos — nothing here was implemented in the dashboard; the frontend
only surfaces what Portal already sends today, honestly labeled.

## What prompted this

The dashboard wanted to show, per node: real warning detail, the status of
every system app (manager/gitmon/mailler), watchdog's security status and
logs, and each system app's reported application + ais_library version. Only
the last one turned out to be fully available today.

## Gap 1 — `manager_data.warning` collapses to a single sticky bit

**Source:** `ais_manager/src/system/manager.rs::get_manager_data`

```rust
static WATCHDOG_SECURITY_TRIPPED_EVER: Lazy<AtomicBool> = ...;
// NOTE: The portal warning count is now reserved for watchdog security/tamper
// trips only.
warning: watchdog_security_warning,  // 1 if tripped at any point since manager
                                      // started, else 0 -- never clears itself
```

`ManagerData.warning` is not a count of anything. It's `0` or `1`, set once a
security/tamper trip is observed via `watchdog::get_security_trip_status()`
(a local gRPC call over `/tmp/artisan_watchdog.sock`), and it never resets
until the manager process restarts — even after the underlying issue is
resolved.

**What's missing:** the actual `SecurityTripStatus` message from watchdog
(reason, timestamp, whatever else it carries — see `ais_manager/proto/watchdog.proto`)
is fetched locally but discarded; only the boolean survives into `ManagerData`.
There's no list of individual warnings/trips anywhere that reaches Portal.

**To fix:** `ManagerData` (or a new field alongside it) would need to carry the
full `SecurityTripStatus` (or a history of trips) instead of collapsing it to
one bit, and Portal's `/node/{id}` handler would need to pass it through.

## Gap 2 — no per-node system-app status

**Source:** `portal/src/api/handler/v1.rs`, `handle_get_runners_v1` and
`handle_get_runner_data_v1`

- `GET /runners` includes `manager`/`gitmon`/`mailler` for a Super, but every
  node's instance shares the exact same literal name, and the handler dedupes
  by name — so all nodes' `manager` entries collapse into one row (worst-of
  aggregated status), not one per node.
- `GET /node/{id}` (via `/nodes`) never lists `manager`/`gitmon`/`mailler` in
  a node's own `projects` array, so there's no key to filter `/runners`' rows
  down to "just this node's copy."
- `GET /runner/{id}` — the endpoint with real per-instance status, health and
  logs — **explicitly excludes system apps**, both for the permission check
  and the response loop:
  ```rust
  let has_access = if sanitized_server == "manager" || sanitized_server == "gitmon" {
      false
  } else { ... };
  ...
  // Skipping system applications
  if project_name == "manager" || project_name == "gitmon" { continue; }
  ```
  This is deliberate, not an oversight — worth confirming with whoever wrote
  it before changing it, in case there's a reason (e.g. these aren't meant to
  be user-visible "projects").

**What's missing:** a way to ask "what's the status of node X's own manager
(or gitmon)" specifically. The data exists locally on each node (ais_manager's
`APP_STATUS_ARRAY`, populated by `refresh_status_from_watchdog` in
`ais_manager/src/applications/watchdog_sync.rs`) but isn't tagged with node
identity when it reaches Portal.

**To fix, two options:**
1. Have each node's `ManagerData` (or a new field) carry its own system apps'
   status/version directly, the same way it already carries its own manager
   version — cheapest, and keeps the per-node scoping Portal is missing.
2. Or: have Portal's node registry track system apps per-node the same way it
   tracks client projects (populate `node.projects` for them, or add a
   parallel field), so `/runners`' existing aggregation can be filtered.

Option 1 is probably less invasive since the data (`APP_STATUS_ARRAY`) is
already sitting on the node, right next to where `manager_data.version` is
already built.

## Gap 3 — no watchdog logs anywhere in the API

**Source:** `ais_manager/src/applications/watchdog_sync.rs::refresh_logs_from_state_files`

Per-app stdout/stderr *is* tracked locally (pulled from each app's own state
file into `APP_STATUS_ARRAY`), but that's app logs, and even those only reach
Portal through `/runner/{id}` — which, per Gap 2, excludes system apps
entirely. Watchdog's own log stream (as opposed to the apps it supervises)
wasn't found anywhere in either repo's HTTP-facing code.

**To fix:** would need a new path from watchdog's own logs (wherever they're
written — didn't find this in `ais_manager`, may live entirely in a separate
watchdog repo) through ais_manager and Portal to an HTTP route. Scope
depends on how watchdog logs itself today; that wasn't investigated (out of
these two repos).

## What's NOT a gap — already works today

`SoftwareVersion` (`{application: {number, code}, library: {number, code}}`)
is real and correctly reported by both `manager_data.version` (a node's own
manager) and each entry's `version` in `GET /runners` (including `gitmon`,
fleet-wide). The dashboard's TypeScript type for this was wrong until this
change — it assumed a flat `{version, release}` shape — but the wire format
itself needs no backend change. Aggregate (not per-node) system app status
and version are already visible via `GET /runners` for a Super; the dashboard
now shows this with a "fleet-wide, not per-node" label rather than pretending
it's scoped to whichever node you're looking at.
