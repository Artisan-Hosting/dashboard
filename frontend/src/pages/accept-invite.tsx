import React, { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { API_URL } from "@/lib/config";
import { Button, Field } from "@/components/ui";

export default function AcceptInvitePage() {
    const router = useRouter();
    const { token } = router.query;

    const [displayName, setDisplayName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        if (typeof token !== "string" || !token) {
            setErrorMsg("This invite link is missing its token. Ask whoever invited you to resend it.");
            return;
        }

        if (!displayName.trim()) {
            setErrorMsg("Please enter your name.");
            return;
        }

        if (password !== confirmPassword) {
            setErrorMsg("Passwords don't match.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/auth/accept-invite`, {
                method: "POST",
                credentials: "include", // accepting an invite logs you in, same as login
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, display_name: displayName, password }),
            });

            if (res.ok) {
                router.push("/apps");
            } else {
                setErrorMsg(
                    "This invite may be invalid, expired, or already used. Ask whoever invited you to send a new one."
                );
            }
        } catch (err) {
            setErrorMsg("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    // Wait for the router to hydrate `token` from the query string before
    // deciding whether to show the "missing token" state, so a valid link
    // doesn't briefly flash it on first render.
    const tokenMissing = router.isReady && typeof token !== "string";

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-page">
            <div className="w-full max-w-sm card p-6 sm:p-8">
                <div className="mb-6 flex justify-center">
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

                {tokenMissing ? (
                    <div className="space-y-4 text-center">
                        <p style={{ color: 'var(--text)' }}>
                            This invite link is missing its token.
                        </p>
                        <Link href="/" className="inline-block text-brand hover:underline">
                            Back to log in
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
                            Create your account to accept this invite.
                        </p>

                        {errorMsg && (
                            <div className="error mb-4" role="alert">{errorMsg}</div>
                        )}

                        <form onSubmit={handleSubmit} className="form">
                            <div>
                                <label htmlFor="displayName">Your name</label>
                                <Field
                                    id="displayName"
                                    type="text"
                                    sans
                                    required
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label htmlFor="password">Password</label>
                                <Field
                                    id="password"
                                    type="password"
                                    sans
                                    required
                                    minLength={8}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <div>
                                <label htmlFor="confirmPassword">Confirm password</label>
                                <Field
                                    id="confirmPassword"
                                    type="password"
                                    sans
                                    required
                                    minLength={8}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>

                            <Button type="submit" disabled={submitting}>
                                {submitting ? "Creating account..." : "Create account"}
                            </Button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
