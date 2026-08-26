// src/components/LoadingRingSpinner.tsx

// Spinner de dois anéis concêntricos girando em sentidos opostos + círculo
// central pulsante — mesmo efeito visual usado em todos os cards de métrica
// e nos gráficos do dashboard, só variando a paleta de cores por contexto.

const PALETTES = {
    'purple-blue': {
        outer: 'border-t-purple-600 border-r-purple-400',
        inner: 'border-b-blue-600 border-l-blue-400',
        center: 'from-purple-100 to-blue-100',
        dot: 'from-purple-500 to-blue-500',
    },
    'cyan-blue': {
        outer: 'border-t-cyan-600 border-r-cyan-400',
        inner: 'border-b-blue-600 border-l-blue-400',
        center: 'from-cyan-100 to-blue-100',
        dot: 'from-cyan-500 to-blue-500',
    },
    'blue-indigo': {
        outer: 'border-t-blue-600 border-r-blue-400',
        inner: 'border-b-indigo-600 border-l-indigo-400',
        center: 'from-blue-100 to-indigo-100',
        dot: 'from-blue-500 to-indigo-500',
    },
    'teal-cyan': {
        outer: 'border-t-teal-600 border-r-teal-400',
        inner: 'border-b-cyan-600 border-l-cyan-400',
        center: 'from-teal-100 to-cyan-100',
        dot: 'from-teal-500 to-cyan-500',
    },
    orange: {
        outer: 'border-t-orange-600 border-r-orange-400',
        inner: 'border-b-orange-600 border-l-orange-400',
        center: 'from-orange-100 to-orange-100',
        dot: 'from-orange-500 to-orange-500',
    },
    purple: {
        outer: 'border-t-purple-600 border-r-purple-400',
        inner: 'border-b-purple-600 border-l-purple-400',
        center: 'from-purple-100 to-purple-100',
        dot: 'from-purple-500 to-purple-500',
    },
    cyan: {
        outer: 'border-t-cyan-600 border-r-cyan-400',
        inner: 'border-b-cyan-600 border-l-cyan-400',
        center: 'from-cyan-100 to-cyan-100',
        dot: 'from-cyan-500 to-cyan-500',
    },
    blue: {
        outer: 'border-t-blue-600 border-r-blue-400',
        inner: 'border-b-blue-600 border-l-blue-400',
        center: 'from-blue-100 to-blue-100',
        dot: 'from-blue-500 to-blue-500',
    },
    green: {
        outer: 'border-t-green-600 border-r-green-400',
        inner: 'border-b-green-600 border-l-green-400',
        center: 'from-green-100 to-green-100',
        dot: 'from-green-500 to-green-500',
    },
} as const;

export type LoadingRingPalette = keyof typeof PALETTES;

interface LoadingRingSpinnerProps {
    palette: LoadingRingPalette;
    size?: number;
}

export function LoadingRingSpinner({ palette, size = 80 }: LoadingRingSpinnerProps) {
    const colors = PALETTES[palette];

    return (
        <div className="relative" style={{ height: size, width: size }}>
            {/* Anel externo — gira no sentido horário */}
            <div
                className={`absolute inset-0 animate-spin rounded-full border-4 border-transparent ${colors.outer}`}
            />

            {/* Anel interno — gira no sentido anti-horário */}
            <div
                className={`absolute inset-2 animate-[spin_1s_linear_infinite_reverse] rounded-full border-4 border-transparent ${colors.inner}`}
            />

            {/* Círculo central pulsante */}
            <div
                className={`absolute inset-4 flex items-center justify-center rounded-full bg-gradient-to-br ${colors.center}`}
            >
                <div
                    className={`h-6 w-6 animate-pulse rounded-full bg-gradient-to-br ${colors.dot}`}
                />
            </div>
        </div>
    );
}
