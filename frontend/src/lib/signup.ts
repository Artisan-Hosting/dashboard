// Public self-signup: the pages under /signup and /welcome call these.
//
// The browser talks to the dashboard backend (`/api/auth/signup*`), which
// forwards to ais_auth. Either ais_auth's gateway (`{"error": "..."}`) or
// Portal (`{"errors": [{"message": "..."}]}`) can sit behind that, so errors
// are read from both shapes.
import { API_URL } from './config';
import { postWithAuth } from './api';

export interface SignupConfig {
  captchaEnabled: boolean;
  captchaEndpoint: string;
}

function messageOf(body: any, fallback: string): string {
  if (!body) return fallback;
  if (typeof body === 'string') return body || fallback;
  if (typeof body.error === 'string' && body.error) return body.error;
  const first = Array.isArray(body.errors) ? body.errors[0] : undefined;
  if (first && typeof first.message === 'string' && first.message) return first.message;
  return fallback;
}

async function readBody(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function postPublic(path: string, body: unknown): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/${path}`, {
      method: 'POST',
      credentials: 'include', // verify sets the session cookie
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const parsed = await readBody(res);
  if (!res.ok) {
    if (res.status >= 500) {
      throw new Error(messageOf(parsed, 'Something went wrong on our side. Please try again in a moment.'));
    }
    throw new Error(messageOf(parsed, 'That did not work. Check what you entered and try again.'));
  }
  return parsed;
}

/** Whether to show the Cap widget, and where it points. A failed lookup is
 * treated as "off": the server still enforces it and will say so. */
export async function getSignupConfig(): Promise<SignupConfig> {
  try {
    const res = await fetch(`${API_URL}/auth/signup/config`, { credentials: 'include' });
    if (!res.ok) return { captchaEnabled: false, captchaEndpoint: '' };
    const body = await res.json();
    const data = body?.data ?? body; // Portal wraps in an envelope, ais_auth does not
    return {
      captchaEnabled: !!data?.captcha_enabled,
      captchaEndpoint: typeof data?.captcha_endpoint === 'string' ? data.captcha_endpoint : '',
    };
  } catch {
    return { captchaEnabled: false, captchaEndpoint: '' };
  }
}

/** Always resolves for a well-formed request, whether or not the address
 * already has an account: the page must say the same thing either way. */
export async function startSignup(input: {
  email: string;
  displayName: string;
  password: string;
  captchaToken: string;
}): Promise<void> {
  await postPublic('auth/signup', {
    email: input.email,
    display_name: input.displayName,
    password: input.password,
    captcha_token: input.captchaToken,
  });
}

export async function resendSignup(email: string, captchaToken: string): Promise<void> {
  await postPublic('auth/signup/resend', { email, captcha_token: captchaToken });
}

/** Opens the emailed link: creates the account and signs the person in. */
export async function verifySignup(token: string): Promise<void> {
  try {
    await postPublic('auth/signup/verify', { token });
  } catch (err: any) {
    // One answer for every failure: a used, expired and made-up link look alike.
    throw new Error(
      err?.message?.startsWith('Could not reach') ? err.message : 'This link is invalid, expired, or already used. Request a new one.',
    );
  }
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

/** The new Admin naming their draft organization (once). */
export async function renameOrganization(name: string): Promise<OrganizationSummary> {
  let res: any;
  try {
    res = await postWithAuth('proxy/account/organization', { name });
  } catch (err: any) {
    // postWithAuth throws "API Error: <status> <body>"; pull the message back out.
    const raw = String(err?.message ?? '');
    const json = raw.slice(raw.indexOf('{'));
    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch {
      parsed = undefined;
    }
    throw new Error(messageOf(parsed, 'Could not save the name. Please try again.'));
  }
  const data = res?.data ?? res;
  return { id: data.id, name: data.name, slug: data.slug };
}

/** The same derivation ais_auth applies, for the live preview only. The
 * server's answer is the one that counts (it also de-duplicates). */
export function previewSlug(name: string): string {
  const s = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return s.length >= 3 ? s : '';
}
