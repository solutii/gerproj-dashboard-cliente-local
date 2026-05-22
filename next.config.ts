import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    experimental: {
        // Reduz consumo de memória no dev server
        webpackMemoryOptimizations: true,
    },

    webpack: (config, { dev, isServer }) => {
        if (dev) {
            // Limita paralelismo do webpack em desenvolvimento
            config.parallelism = 2;

            // Reduz snapshots desnecessários (grande impacto na memória)
            config.snapshot = {
                ...config.snapshot,
                managedPaths: [/^(.+?[\\/]node_modules[\\/])/],
                immutablePaths: [],
            };
        }
        return config;
    },
};

export default nextConfig;
