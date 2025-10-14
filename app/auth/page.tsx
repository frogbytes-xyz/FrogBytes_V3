'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const mode = searchParams.get('mode');
    const redirect = searchParams.get('redirect');
    
    // Redirect to appropriate page based on mode
    if (mode === 'signup') {
      router.replace(redirect ? `/register?redirect=${redirect}` : '/register');
    } else if (mode === 'reset' || mode === 'forgot') {
      router.replace('/forgot-password');
    } else {
      // Default to login
      router.replace(redirect ? `/login?redirect=${redirect}` : '/login');
    }
  }, [router, searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </main>
    }>
      <AuthPageContent />
    </Suspense>
  );
}
