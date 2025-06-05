import router from "next/router";

export async function handleLogout() {
    await fetch(`${process.env.NEXT_PUBLIC_PRIMARY_API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
    });
    router.push('/');
}