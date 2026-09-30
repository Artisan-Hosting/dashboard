import { useCallback, useEffect, useState } from 'react';
import { fetchOrgPolicy, setOrgPolicyRow } from '@/lib/api';
import { OrgPolicyRow } from '@/lib/types';

// Only these resource types actually resolve to an owning org in ais_auth's
// access engine (`resolve_resource_org`) -- an org-level policy row for any
// other resource type is silently inert today, so this editor doesn't offer
// them: showing a toggle that changes nothing would be dishonest UI.
const RESOURCE_TYPES = ['project', 'instance', 'secret', 'subscription'] as const;
const ACTIONS = ['read', 'write', 'control', 'delete', 'grant', 'purchase'] as const;
// Never SUPER (always allowed, not policy-driven) or none (rejected by
// ais_auth's `set_org_policy` as "not a grantable policy role").
const ROLES = ['admin', 'controller', 'viewer', 'audit'] as const;

const GLOBAL_ORG_ALIAS = 'GLOBAL';

function policyKey(resourceType: string, action: string, role: string) {
  return `${resourceType}:${action}:${role}`;
}

function toMap(rows: OrgPolicyRow[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const row of rows) {
    if (row.allow) {
      map[policyKey(row.resource_type, row.action, row.role)] = true;
    }
  }
  return map;
}

interface PolicyMatrixProps {
  orgId: string;
  isSuper: boolean;
  // Structurally compatible with the `useElevatedSession()` hook in
  // pages/admin/index.tsx -- only the two fields this component needs.
  elevated: {
    token: string | null;
    isElevated: boolean;
  };
}

export function PolicyMatrix({ orgId, isSuper, elevated }: PolicyMatrixProps) {
  const [viewingGlobal, setViewingGlobal] = useState(false);
  const [orgPolicy, setOrgPolicy] = useState<Record<string, boolean>>({});
  const [globalPolicy, setGlobalPolicy] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const editingOrgId = isSuper && viewingGlobal ? GLOBAL_ORG_ALIAS : orgId;

  const load = useCallback(async () => {
    if (!editingOrgId) {
      setOrgPolicy({});
      return;
    }
    try {
      const rows = await fetchOrgPolicy(editingOrgId);
      setOrgPolicy(toMap(rows));
      setLoadError(null);
    } catch (err) {
      setLoadError('Failed to load policy for this organization.');
      setOrgPolicy({});
    }
    // The GLOBAL baseline is always fetched too (any Admin/Super may read
    // it), so an org's own view can show "already allowed by default" next
    // to what the org itself has added. Skipped while editing GLOBAL
    // directly -- there `orgPolicy` *is* the baseline.
    if (editingOrgId !== GLOBAL_ORG_ALIAS) {
      try {
        const rows = await fetchOrgPolicy(GLOBAL_ORG_ALIAS);
        setGlobalPolicy(toMap(rows));
      } catch (err) {
        setGlobalPolicy({});
      }
    }
  }, [editingOrgId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (resourceType: string, action: string, role: string, next: boolean) => {
    if (!elevated.token || !editingOrgId) return;
    const key = policyKey(resourceType, action, role);
    setSavingKey(key);
    setSaveError(null);
    try {
      await setOrgPolicyRow(editingOrgId, {
        elevated_token: elevated.token,
        resource_type: resourceType,
        action,
        role,
        allow: next,
      });
      setOrgPolicy((prev) => ({ ...prev, [key]: next }));
    } catch (err) {
      setSaveError('Failed to update that permission -- check your access level.');
    } finally {
      setSavingKey(null);
    }
  };

  if (!orgId) {
    return null;
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold text-brand">
          Role Policy{editingOrgId && editingOrgId !== GLOBAL_ORG_ALIAS ? ` -- org ${editingOrgId}` : ''}
          {editingOrgId === GLOBAL_ORG_ALIAS ? ' -- GLOBAL (platform default)' : ''}
        </h2>
        {isSuper && (
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <input
              type="checkbox"
              checked={viewingGlobal}
              onChange={(e) => setViewingGlobal(e.target.checked)}
            />
            Edit GLOBAL (platform default) instead
          </label>
        )}
      </div>

      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        {editingOrgId === GLOBAL_ORG_ALIAS
          ? 'Editing the platform-wide default every organization inherits.'
          : 'An organization can only grant a role more than the platform default already allows -- it can never take a permission away that the platform default grants. Greyed, checked cells are already allowed by the platform default and cannot be revoked here.'}
      </p>

      {loadError && <p className="text-sm text-red-500">{loadError}</p>}
      {saveError && <p className="text-sm text-red-500">{saveError}</p>}
      {!elevated.isElevated && (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>Unlock admin actions above to edit policy.</p>
      )}

      <div className="space-y-6">
        {RESOURCE_TYPES.map((resourceType) => (
          <div key={resourceType}>
            <h3 className="font-semibold text-sm text-brand mb-2 capitalize">{resourceType}</h3>
            <div className="overflow-x-auto">
              <table className="text-sm w-full">
                <thead>
                  <tr>
                    <th className="text-left font-medium pr-4 py-1" style={{ color: 'var(--muted)' }}>Action</th>
                    {ROLES.map((role) => (
                      <th key={role} className="text-left font-medium px-2 py-1 capitalize" style={{ color: 'var(--muted)' }}>
                        {role}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ACTIONS.map((action) => (
                    <tr key={action}>
                      <td className="pr-4 py-1 capitalize">{action}</td>
                      {ROLES.map((role) => {
                        const key = policyKey(resourceType, action, role);
                        const globalAllow = editingOrgId !== GLOBAL_ORG_ALIAS && !!globalPolicy[key];
                        const orgAllow = !!orgPolicy[key];
                        const checked = editingOrgId === GLOBAL_ORG_ALIAS ? orgAllow : globalAllow || orgAllow;
                        const disabled =
                          !elevated.isElevated ||
                          savingKey === key ||
                          (editingOrgId !== GLOBAL_ORG_ALIAS && globalAllow);
                        return (
                          <td key={role} className="px-2 py-1">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              title={
                                editingOrgId !== GLOBAL_ORG_ALIAS && globalAllow
                                  ? 'Already allowed by the platform default'
                                  : !elevated.isElevated
                                    ? 'Unlock admin actions first'
                                    : undefined
                              }
                              onChange={(e) => toggle(resourceType, action, role, e.target.checked)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
