import { createElement, useEffect, useRef } from 'react';

const SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/cap-widget@latest';

// Cap (trycap.dev) is a self-hosted proof-of-work captcha. Its widget is a web
// component, loaded once from the CDN the same way the websites load it. The
// token it hands back is single use: after any failed submit, call `reset`.
function loadScript(): void {
  if (typeof document === 'undefined' || document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
  const el = document.createElement('script');
  el.src = SCRIPT_SRC;
  el.async = true;
  document.head.appendChild(el);
}

export interface CapHandle {
  reset: () => void;
}

export function CapWidget({
  endpoint,
  onToken,
  handle,
}: {
  endpoint: string;
  onToken: (token: string) => void;
  handle?: React.MutableRefObject<CapHandle | null>;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    loadScript();
    const el = ref.current as any;
    if (!el) return;
    const solved = (e: any) => onToken(e?.detail?.token ?? '');
    const resetEv = () => onToken('');
    el.addEventListener('solve', solved);
    el.addEventListener('reset', resetEv);
    if (handle) handle.current = { reset: () => el.reset?.() };
    return () => {
      el.removeEventListener('solve', solved);
      el.removeEventListener('reset', resetEv);
      if (handle) handle.current = null;
    };
  }, [endpoint, onToken, handle]);

  return createElement('cap-widget', { ref, 'data-cap-api-endpoint': endpoint });
}
