// src/app/ClientProviders.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '../components/providers/AuthProvider';

export function ClientProviders({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                {children}
                <Toaster
                    position="top-center"
                    containerClassName="!z-[9999]"
                    toastOptions={{
                        duration: 4000,
                        success: {
                            style: {
                                background: '#10B981',
                                color: '#fff',
                                fontWeight: 600,
                                padding: '16px',
                                borderRadius: '12px',
                            },
                            iconTheme: {
                                primary: '#fff',
                                secondary: '#10B981',
                            },
                        },
                        error: {
                            style: {
                                background: '#EF4444',
                                color: '#fff',
                                fontWeight: 600,
                                padding: '16px',
                                borderRadius: '12px',
                            },
                            iconTheme: {
                                primary: '#fff',
                                secondary: '#EF4444',
                            },
                        },
                    }}
                />
            </AuthProvider>
        </QueryClientProvider>
    );
}
