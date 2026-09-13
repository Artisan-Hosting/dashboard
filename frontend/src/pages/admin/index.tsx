import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/header';
import { RequireAdmin } from '@/components/requireAdmin';
import { fetchWithAuth, postWithAuth } from '@/lib/api';
import { handleLogout, handleLogoutAll } from '@/lib/logout';
import { useUser } from '@/hooks/useUser';

interface Organization {
  id: string;
  name: string;
  created_at: number;
}

interface UserSummary {
  id: string;
  email: string;
  display_name: string;
  role: string;
  org_id: string;
}

interface Invite {
  id: string;
  email: string;
  org_id: string;
  role: string;
  created_at: number;
  expires_at: number;
}

const ROLE_OPTIONS = ['SUPER', 'admin', 'controller', 'viewer', 'audit', 'none'];

/// Step-up auth: an elevated token is only ever held in memory (state, not
/// storage) and only for the few minutes ais_auth's ElevateSession actually
/// grants it for -- a page refresh means re-entering the password again.
function useElevatedSession() {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const secondsLeft = expiresAt ? Math.max(0, Math.round((expiresAt - Date.now()) / 1000)) : 0;
  const isElevated = !!token && secondsLeft > 0;

  const elevate = async () => {
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await postWithAuth('proxy/admin/elevate', { password });
      const data = res.data;
      setToken(data.elevated_token);
      setExpiresAt(Date.now() + data.expires_in * 1000);
      setPassword('');
    } catch (err: any) {
      setError('Incorrect password, or elevation failed.');
      setToken(null);
      setExpiresAt(null);
    } finally {
      setBusy(false);
    }
  };

  return { token, isElevated, secondsLeft, password, setPassword, busy, error, elevate };
}

export default function AdminPage() {
  const { role, orgId: myOrgId } = useUser();
  const isSuper = role === 'SUPER';
  const elevated = useElevatedSession();

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgsError, setOrgsError] = useState<string | null>(null);
  const [newOrgName, setNewOrgName] = useState('');

  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');

  const loadOrgs = useCallback(async () => {
    if (!isSuper) return;
    try {
      const res = await fetchWithAuth('proxy/admin/organizations');
      setOrgs(res.data || []);
      setOrgsError(null);
    } catch (err) {
      setOrgsError('Failed to load organizations (Super access required).');
    }
  }, [isSuper]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  // Non-Super admins only ever have one org to look at: their own.
  useEffect(() => {
    if (!isSuper && myOrgId) {
      setSelectedOrgId(myOrgId);
    }
  }, [isSuper, myOrgId]);

  const loadUsers = useCallback(async (orgId: string) => {
    if (!orgId) {
      setUsers([]);
      return;
    }
    try {
      const res = await fetchWithAuth(`proxy/admin/organizations/${orgId}/users`);
      setUsers(res.data || []);
      setUsersError(null);
    } catch (err) {
      setUsersError('Failed to load users for that organization.');
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    loadUsers(selectedOrgId);
  }, [selectedOrgId, loadUsers]);

  const loadInvites = useCallback(async (orgId: string) => {
    if (!orgId) {
      setInvites([]);
      return;
    }
    try {
      const res = await fetchWithAuth(`proxy/admin/invites?org_id=${encodeURIComponent(orgId)}`);
      setInvites(res.data || []);
      setInvitesError(null);
    } catch (err) {
      setInvitesError('Failed to load invites for that organization.');
      setInvites([]);
    }
  }, []);

  useEffect(() => {
    loadInvites(selectedOrgId);
  }, [selectedOrgId, loadInvites]);

  const createOrg = async () => {
    if (!newOrgName.trim() || !elevated.token) return;
    setStatusMessage(null);
    try {
      await postWithAuth('proxy/admin/organizations', {
        elevated_token: elevated.token,
        name: newOrgName.trim(),
      });
      setNewOrgName('');
      setStatusMessage(`Created organization "${newOrgName.trim()}".`);
      loadOrgs();
    } catch (err) {
      setStatusMessage('Failed to create organization.');
    }
  };

  const reassignUser = async (userId: string, newOrgId: string, newRole: string) => {
    if (!elevated.token) return;
    setStatusMessage(null);
    try {
      await postWithAuth(`proxy/admin/users/${userId}/org`, {
        elevated_token: elevated.token,
        org_id: newOrgId,
        role: newRole,
      });
      setStatusMessage('User updated.');
      loadUsers(selectedOrgId);
    } catch (err) {
      setStatusMessage('Failed to update user -- check the role/org and your access level.');
    }
  };

  const createInvite = async () => {
    if (!inviteEmail.trim() || !selectedOrgId || !elevated.token) return;
    setStatusMessage(null);
    try {
      await postWithAuth('proxy/admin/invites', {
        elevated_token: elevated.token,
        email: inviteEmail.trim(),
        org_id: selectedOrgId,
        role: inviteRole,
      });
      setInviteEmail('');
      setStatusMessage(`Invited ${inviteEmail.trim()}.`);
      loadInvites(selectedOrgId);
    } catch (err) {
      setStatusMessage('Failed to create invite -- check the role and your access level.');
    }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!elevated.token) return;
    setStatusMessage(null);
    try {
      await postWithAuth(`proxy/admin/invites/${inviteId}/revoke`, {
        elevated_token: elevated.token,
      });
      setStatusMessage('Invite revoked.');
      loadInvites(selectedOrgId);
    } catch (err) {
      setStatusMessage('Failed to revoke invite.');
    }
  };

  return (
    <RequireAdmin>
      <div className="min-h-screen flex bg-page text-foreground">
        <Sidebar onLogout={handleLogout} onLogoutAll={handleLogoutAll} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          <h1 className="text-3xl font-bold text-brand mb-2">Admin</h1>
          <p className="text-sm text-gray-400">
            Signed in as <span className="font-semibold">{role}</span>
            {myOrgId && <> in org <span className="font-semibold">{myOrgId}</span></>}.
          </p>

          {/* Step-up auth */}
          <div className="card p-6 space-y-3">
            <h2 className="font-semibold text-brand">Admin actions</h2>
            {elevated.isElevated ? (
              <p className="text-sm text-green-500">
                Unlocked -- expires in {elevated.secondsLeft}s. Creating an org or reassigning a
                user re-checks this automatically once it expires.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <input
                  type="password"
                  placeholder="Re-enter your password to unlock write actions"
                  value={elevated.password}
                  onChange={(e) => elevated.setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && elevated.elevate()}
                  className="w-full sm:w-96 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                />
                <button
                  onClick={elevated.elevate}
                  disabled={elevated.busy || !elevated.password}
                  className="btn-brand px-4 py-2 rounded disabled:opacity-50"
                >
                  {elevated.busy ? 'Checking...' : 'Unlock'}
                </button>
              </div>
            )}
            {elevated.error && <p className="text-sm text-red-500">{elevated.error}</p>}
            {statusMessage && <p className="text-sm text-gray-400">{statusMessage}</p>}
          </div>

          {/* Organizations -- Super only, matching ais_auth's own gate */}
          {isSuper && (
            <div className="card p-6 space-y-4">
              <h2 className="font-semibold text-brand">Organizations</h2>
              {orgsError && <p className="text-sm text-red-500">{orgsError}</p>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {orgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => setSelectedOrgId(org.id)}
                    className={`card-hover p-4 text-left space-y-1 ${
                      selectedOrgId === org.id ? 'ring-2 ring-brand' : ''
                    }`}
                  >
                    <p className="font-semibold">{org.name}</p>
                    <p className="text-xs text-gray-400">id: {org.id}</p>
                  </button>
                ))}
                {orgs.length === 0 && !orgsError && (
                  <p className="text-gray-500 text-sm">No organizations yet.</p>
                )}
              </div>

              <div className="border-t border-gray-300 dark:border-gray-700 pt-4">
                <h3 className="font-semibold text-brand mb-2 text-sm">Create Organization</h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    placeholder="Organization name"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    className="w-full sm:w-72 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                  />
                  <button
                    onClick={createOrg}
                    disabled={!elevated.isElevated || !newOrgName.trim()}
                    className="btn-brand px-4 py-2 rounded disabled:opacity-50"
                    title={!elevated.isElevated ? 'Unlock admin actions first' : undefined}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Users in the selected org */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-brand">
              Users{selectedOrgId ? ` -- org ${selectedOrgId}` : ''}
            </h2>
            {!isSuper && (
              <p className="text-xs text-gray-500">
                Admins can only view/reassign users within their own organization.
              </p>
            )}
            {usersError && <p className="text-sm text-red-500">{usersError}</p>}
            {!selectedOrgId && <p className="text-gray-500 text-sm">Select an organization above.</p>}

            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="card-hover p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{user.display_name || user.email}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <select
                    defaultValue={user.role}
                    disabled={!elevated.isElevated}
                    onChange={(e) => reassignUser(user.id, user.org_id, e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-sm disabled:opacity-50"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {isSuper && (
                    <select
                      defaultValue={user.org_id}
                      disabled={!elevated.isElevated}
                      onChange={(e) => reassignUser(user.id, e.target.value, user.role)}
                      className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-sm disabled:opacity-50"
                    >
                      {orgs.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pending invites for the selected org */}
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold text-brand">
              Invites{selectedOrgId ? ` -- org ${selectedOrgId}` : ''}
            </h2>
            {invitesError && <p className="text-sm text-red-500">{invitesError}</p>}
            {!selectedOrgId && <p className="text-gray-500 text-sm">Select an organization above.</p>}

            {selectedOrgId && (
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center border-b border-gray-300 dark:border-gray-700 pb-4">
                <input
                  type="email"
                  placeholder="Email to invite"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full sm:w-64 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-sm"
                >
                  {(isSuper ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r !== 'SUPER')).map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  onClick={createInvite}
                  disabled={!elevated.isElevated || !inviteEmail.trim()}
                  className="btn-brand px-4 py-2 rounded disabled:opacity-50"
                  title={!elevated.isElevated ? 'Unlock admin actions first' : undefined}
                >
                  Invite
                </button>
              </div>
            )}

            <div className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="card-hover p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{invite.email}</p>
                    <p className="text-xs text-gray-400">
                      {invite.role} -- expires{' '}
                      {new Date(invite.expires_at * 1000).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => revokeInvite(invite.id)}
                    disabled={!elevated.isElevated}
                    className="text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
                    title={!elevated.isElevated ? 'Unlock admin actions first' : undefined}
                  >
                    Revoke
                  </button>
                </div>
              ))}
              {invites.length === 0 && selectedOrgId && !invitesError && (
                <p className="text-gray-500 text-sm">No pending invites.</p>
              )}
            </div>
          </div>
        </main>
      </div>
    </RequireAdmin>
  );
}
