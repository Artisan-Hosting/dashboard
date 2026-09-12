import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useUser } from '@/hooks/useUser';
import LoadingOverlay from '@/components/loading';

export function isAdminRole(role: string): boolean {
  return role === 'admin' || role === 'SUPER';
}

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { role, isLoading } = useUser();
  const router = useRouter();
  const isAdmin = isAdminRole(role);

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace('/apps');
    }
  }, [isLoading, isAdmin, router]);

  if (isLoading) return <LoadingOverlay />;
  if (!isAdmin) return null;
  return <>{children}</>;
}
