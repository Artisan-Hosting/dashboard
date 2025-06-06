import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { jwtDecode } from "jwt-decode";
import logo from "../img/logo.webp";
import LoadingOverlay from "@/components/loading";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // This effect will run only once, on mount
        fetch(`${process.env.NEXT_PUBLIC_PRIMARY_API_URL}/auth/whoami`, {
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
                // console.error("Network error checking session:", err);
                setLoading(false);
            });
    }, [])

    // src/pages/login.tsx (inside handleLogin)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        const res = await fetch(
            `${process.env.NEXT_PUBLIC_PRIMARY_API_URL}/auth/login`,
            {
                method: "POST",
                credentials: "include",            // ← tell the browser to accept & store the Set-Cookie
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            }
        );

        if (res.ok) {
            router.push("/account");
        }
    };


    return (
        <div className="relative flex min-h-screen items-center justify-center bg-page">
            <div className="w-full max-w-sm card p-6 sm:p-8">
                <div className="mb-6 flex justify-center">
                    <img src="/logo.webp" alt="Artisan Hosting" className="h-36 w-auto" />
                </div>

                {/* <h1 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100">
                    Artisan Hosting Dashboard
                </h1> */}

                {errorMsg && (
                    <p className="text-red-500 mb-4 text-center">{errorMsg}</p>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
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
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                        Log In
                    </button>

                    <button
                        type="reset"
                        className="w-full bg-gray-600 hover:bg-gray-600 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                        SSO
                    </button>
                </form>
            </div>
            {loading && <LoadingOverlay />}
        </div>
    );
}
