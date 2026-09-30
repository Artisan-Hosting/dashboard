import React, { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { API_URL } from "@/lib/config";
import { Button, Field } from "@/components/ui";

export default function ResetPasswordPage() {
    const router = useRouter();
    const { token } = router.query;

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg("");

        if (typeof token !== "string" || !token) {
            setErrorMsg("This reset link is missing its token. Please request a new one.");
            return;
        }

        if (password !== confirmPassword) {
            setErrorMsg("Passwords don't match.");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${API_URL}/auth/password-reset/confirm`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password_token: token, password }),
            });

            if (res.ok) {
                setSuccess(true);
            } else {
                setErrorMsg(
                    "This link may be invalid or expired. Please request a new one."
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

                {success ? (
                    <div className="space-y-4 text-center">
                        <p style={{ color: 'var(--text)' }}>
                            Your password has been reset.
                        </p>
                        <Link href="/" className="inline-block text-brand hover:underline">
                            Log in
                        </Link>
                    </div>
                ) : tokenMissing ? (
                    <div className="space-y-4 text-center">
                        <p style={{ color: 'var(--text)' }}>
                            This reset link is missing its token.
                        </p>
                        <Link href="/forgot-password" className="inline-block text-brand hover:underline">
                            Request a new link
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
                            Choose a new password for your account.
                        </p>

                        {errorMsg && (
                            <div className="error mb-4" role="alert">{errorMsg}</div>
                        )}

                        <form onSubmit={handleSubmit} className="form">
                            <div>
                                <label htmlFor="password">New password</label>
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
                                <label htmlFor="confirmPassword">Confirm new password</label>
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
                                {submitting ? "Resetting..." : "Reset password"}
                            </Button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
