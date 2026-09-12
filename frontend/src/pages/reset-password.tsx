import React, { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { API_URL } from "@/lib/config";

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
                        <p className="text-gray-700 dark:text-gray-300">
                            Your password has been reset.
                        </p>
                        <Link
                            href="/"
                            className="inline-block text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                            Log in
                        </Link>
                    </div>
                ) : tokenMissing ? (
                    <div className="space-y-4 text-center">
                        <p className="text-gray-700 dark:text-gray-300">
                            This reset link is missing its token.
                        </p>
                        <Link
                            href="/forgot-password"
                            className="inline-block text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                            Request a new link
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                            Choose a new password for your account.
                        </p>

                        {errorMsg && (
                            <p className="text-red-500 mb-4 text-center">{errorMsg}</p>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    New password
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    minLength={8}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="confirmPassword"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    Confirm new password
                                </label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    required
                                    minLength={8}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                            >
                                {submitting ? "Resetting..." : "Reset password"}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
