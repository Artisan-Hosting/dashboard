import React, { useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/config";

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
                        <p className="text-gray-700 dark:text-gray-300">
                            If that address has an account, a password reset email has
                            been sent. Check your inbox for a link to choose a new
                            password.
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
                            Enter the email address on your account and we'll send you a
                            link to reset your password.
                        </p>

                        {errorMsg && (
                            <p className="text-red-500 mb-4 text-center">{errorMsg}</p>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                                >
                                    Email
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                            >
                                {submitting ? "Sending..." : "Send reset link"}
                            </button>

                            <Link
                                href="/"
                                className="block text-center text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                                Back to log in
                            </Link>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
