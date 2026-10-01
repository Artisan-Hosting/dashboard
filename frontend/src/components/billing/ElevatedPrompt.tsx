import { Button, Field } from '@/components/ui';
import type { useElevatedSession } from '@/hooks/useElevatedSession';

// The password re-entry that unlocks anything that spends money. The token
// only lives in the session hook's memory, for the few minutes ais_auth
// grants it.
export function ElevatedPrompt({
  elevated,
  label = 'Re-enter your password to pay',
}: {
  elevated: ReturnType<typeof useElevatedSession>;
  label?: string;
}) {
  return (
    <div className="flex gap-2 items-center flex-wrap">
      <Field
        sans
        type="password"
        placeholder={label}
        aria-label={label}
        value={elevated.password}
        onChange={(e) => elevated.setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && elevated.elevate()}
      />
      <Button onClick={elevated.elevate} disabled={elevated.busy || !elevated.password}>
        {elevated.busy ? 'Checking...' : 'Unlock'}
      </Button>
      {elevated.error && <span className="text-sm text-red-500">{elevated.error}</span>}
    </div>
  );
}
