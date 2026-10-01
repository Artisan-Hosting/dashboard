import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import LoadingOverlay from "@/components/loading";
import { Button, Field } from "@/components/ui";
import { API_URL } from "@/lib/config";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        // This effect will run only once, on mount
        fetch(`${API_URL}/auth/whoami`, {
            method: "GET",
            credentials: "include",
        })
            .then((res) => {
                if (res.status === 200) {
                    // Already authenticated → go to /apps
                    router.push("/apps");
                } else {
                    // Not authenticated → show the login form
                    setLoading(false);
                }
            })
            .catch((err) => {
                // In case of network error, stop loading and let them log in manually
                setLoading(false);
            });
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        if (!email.trim() || !password) {
            setErrorMsg("Enter your email and your password.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(
                `${API_URL}/auth/login`,
                {
                    method: "POST",
                    credentials: "include",            // ← tell the browser to accept & store the Set-Cookie
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password }),
                }
            );

            if (res.ok) {
                router.push("/apps");
            } else {
                // Per the Portal API: a bad-credentials rejection comes back as a
                // bare 500 with no body, indistinguishable from an insufficient
                // token -- there is nothing in the response worth parsing here.
                setErrorMsg("That email and password did not match. Check them and try again.");
            }
        } catch {
            setErrorMsg("Could not reach the server. Check your connection and try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="relative min-h-screen bg-page">
                <LoadingOverlay />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-page">
            <main className="wrap" style={{ maxWidth: 1180, margin: "0 auto", padding: "72px 24px" }}>
                <div className="login">
                    <div>
                        <div className="mb-8 flex justify-center sm:justify-start">
                            <img
                                src="/imgs/artisan-studios__lockup__dark__2048w.webp"
                                alt="Artisan Hosting"
                                className="h-10 w-auto max-w-full dark:hidden"
                            />
                            <img
                                src="/imgs/artisan-studios__lockup__light__2048w.webp"
                                alt="Artisan Hosting"
                                className="hidden h-10 w-auto max-w-full dark:block"
                            />
                        </div>

                        <h1 style={{ fontSize: "2.2rem" }}>Sign in</h1>

                        <form onSubmit={handleLogin} className="form" style={{ marginTop: 24 }}>
                            {errorMsg && (
                                <div className="error" role="alert">
                                    {errorMsg}
                                </div>
                            )}

                            <div>
                                <label htmlFor="email">Email</label>
                                <Field
                                    id="email"
                                    type="email"
                                    sans
                                    required
                                    autoComplete="username"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <div>
                                <label htmlFor="password">Password</label>
                                <Field
                                    id="password"
                                    type="password"
                                    sans
                                    required
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <Button type="submit" disabled={submitting}>
                                {submitting ? "Signing in…" : "Sign in"}
                            </Button>

                            <p>
                                <Link href="/forgot-password" className="text-brand hover:underline">
                                    Forgot your password?
                                </Link>
                            </p>
                        </form>
                    </div>

                    <div>
                        <h2>New here?</h2>
                        <p style={{ marginTop: 8, maxWidth: "46ch" }} className="text-foreground">
                            Create an account and put your own app online. It takes a few minutes.
                        </p>
                        <p style={{ marginTop: 16 }}>
                            <Link href="/signup" className="btn btn-primary">Create an account</Link>
                        </p>

                        <h2 style={{ marginTop: 40 }}>Have an invite instead?</h2>
                        <p style={{ marginTop: 8, maxWidth: "46ch" }} className="text-foreground">
                            If someone on your team sent you an invitation link, use that to create your
                            account rather than signing in here.
                        </p>
                        <ul className="aside-list">
                            <li><b>Projects, domains and usage</b> are scoped to your organization.</li>
                            <li><b>Roles vary by organization.</b> What you can change here depends on
                                whether you're a Viewer, Controller, Admin, or Super.</li>
                            <li><b>Elevated actions</b> (like inviting a teammate) re-check your password
                                before they apply.</li>
                        </ul>
                        <p style={{ marginTop: 24 }}>
                            <Link href="/accept-invite" className="btn btn-ghost">
                                Have an invite token?
                            </Link>
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
