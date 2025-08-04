import router from "next/router";
import { API_URL } from "./config";

export async function handleLogout() {
    await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
    });
    router.push('/');
}

export async function handleLogoutAll() {
    await fetch(`${API_URL}/auth/logout_all`, {
        method: "POST",
        credentials: "include",
    });
    router.push('/');
}