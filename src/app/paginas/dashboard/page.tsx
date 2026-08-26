'use client';

import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Filtros } from '../../../components/Filtros';
import { useFiltersStore } from '../../../store/useFiltersStore';
import { LayoutDashboard } from './Layout_Dashboard';

export default function DashboardPage() {
    const { isLoggedIn } = useAuthStore();
    const filters = useFiltersStore((state) => state.filters);
    const router = useRouter();

    useEffect(() => {
        if (!isLoggedIn) {
            router.push('/paginas/login');
        }
    }, [isLoggedIn, router]);

    if (!isLoggedIn) return null;

    return (
        <LayoutDashboard filters={filters}>
            {/* Área fixa - sem scroll */}
            <div className="flex-shrink-0">
                <Filtros />
            </div>
        </LayoutDashboard>
    );
}
