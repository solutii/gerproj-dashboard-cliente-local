// src/app/ClientProviders.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { AlertDialog } from '../components/AlertDialog';
import { AuthProvider } from '../components/providers/AuthProvider';

export function ClientProviders({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                {children}
                <AlertDialog />
            </AuthProvider>
        </QueryClientProvider>
    );
}
