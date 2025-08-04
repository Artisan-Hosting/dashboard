// /hooks/useUser.ts
import { useState, useEffect } from 'react'
import { BACKEND_URL } from '@/lib/config'

export function useUser() {
    const [username, setUsername] = useState<string>('')
    const [email, setEmail] = useState<string>('')
    const [isLoading, setIsLoading] = useState<boolean>(true)
    const [error, setError] = useState<Error | null>(null)

    useEffect(() => {
        let isMounted = true

        async function fetchUser() {
            try {
                const meRes = await fetch(`${BACKEND_URL}/auth/me`, {
                    method: 'GET',
                    credentials: "include", // ← send the cookie
                    headers: {
                        "Content-Type": "application/json",
                    },
                });

                const meBody = await meRes.json();
                if (isMounted && meBody) {
                    setUsername(meBody.user_id);
                    setEmail(meBody.email)
                }
            } catch (err) {
                if (isMounted) setError(err as Error)
            } finally {
                if (isMounted) setIsLoading(false)
            }
        }

        fetchUser()
        return () => {
            isMounted = false
        }
    }, [])

    return { username, email, isLoading, error }
}
