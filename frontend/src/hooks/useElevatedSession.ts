import { useState } from 'react';
import { postWithAuth } from '@/lib/api';

// Step-up auth: an elevated token is only ever held in memory (state, not
// storage) and only for the few minutes ais_auth's ElevateSession actually
// grants it for -- a page refresh means re-entering the password again.
// Shared by every page that needs to pass `elevated_token` in a write body
// (admin, domains, ...).
export function useElevatedSession() {
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
