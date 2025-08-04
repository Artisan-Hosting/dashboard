import router from "next/router";
import { BACKEND_URL } from "./config";

export async function handleLogout() {
    await fetch(`${BACKEND_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
    });
    router.push('/');
}

export async function handleLogoutAll() {
    await fetch(`${BACKEND_URL}/auth/logout_all`, {
        method: "POST",
        credentials: "include",
    });
    router.push('/');
}