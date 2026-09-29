import React, { useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/config";
import { Button, Field } from "@/components/ui";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setErrorMsg("");

        try {
            await fetch(`${API_URL}/auth/password-reset/request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
        } catch (err) {
            // Network/transport failure only -- the backend always answers
            // with the same generic message regardless of whether the
            // address has an account, so a non-2xx response isn't treated
            // as an error here either.
            setErrorMsg("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
            setSubmitted(true);
        }
    };

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

                {submitted ? (
                    <div className="space-y-4 text-center">
                        <p style={{ color: 'var(--text)' }}>
                            If that address has an account, a password reset email has
                            been sent. Check your inbox for a link to choose a new
                            password.
                        </p>
                        <Link href="/" className="inline-block text-brand hover:underline">
                            Back to log in
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className="mb-4 text-sm" style={{ color: 'var(--muted)' }}>
                            Enter the email address on your account and we'll send you a
                            link to reset your password.
                        </p>

                        {errorMsg && (
                            <div className="error mb-4" role="alert">{errorMsg}</div>
                        )}

                        <form onSubmit={handleSubmit} className="form">
                            <div>
                                <label htmlFor="email">Email</label>
                                <Field
                                    id="email"
                                    type="email"
                                    sans
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>

                            <Button type="submit" disabled={submitting}>
                                {submitting ? "Sending..." : "Send reset link"}
                            </Button>

                            <Link href="/" className="block text-center text-sm text-brand hover:underline">
                                Back to log in
                            </Link>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
