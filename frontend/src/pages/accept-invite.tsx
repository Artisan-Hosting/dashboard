import React, { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { API_URL } from "@/lib/config";

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
                        <p className="text-gray-700 dark:text-gray-300">
                            This invite link is missing its token.
                        </p>
                        <Link
                            href="/"
                            className="inline-block text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                            Back to log in
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                            Create your account to accept this invite.
                        </p>

                        {errorMsg && (
                            <p className="text-red-500 mb-4 text-center">{errorMsg}</p>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="displayName"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    Your name
                                </label>
                                <input
                                    id="displayName"
                                    type="text"
                                    required
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    Password
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
                                    Confirm password
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
                                {submitting ? "Creating account..." : "Create account"}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
