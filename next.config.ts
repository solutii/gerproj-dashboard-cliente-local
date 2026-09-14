import type { NextConfig } from 'next';

// Em dev, o HMR/React Refresh do Next usa eval() e web socket próprio —
// isso só relaxa nesse modo, nunca em produção.
const DEV = process.env.NODE_ENV !== 'production';
const CONNECT_SRC_DEV = DEV ? "connect-src 'self' ws:" : "connect-src 'self'";

// O App Router injeta o payload de hidratação (RSC stream) via <script>
// inline em toda navegação — em dev e em produção, não só em dev — então
// 'unsafe-inline' aqui é necessário pra não quebrar a hidratação de toda
// página. Uma CSP baseada em nonce por requisição eliminaria essa brecha,
// mas exige gerar/propagar o nonce no middleware.ts (que hoje só roda em
// /api/*) pra cada navegação de página; fica como melhoria futura — o app
// não expõe dangerouslySetInnerHTML sem sanitização (DOMPurify) em nenhum
// lugar, o que limita o vetor de XSS que essa diretiva mais frouxa abre.
const SCRIPT_SRC = DEV
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

// CSP padrão do site: nada de scripts/estilos/frames externos — o app não
// carrega CDN nenhuma (fontes via next/font são self-hosted no build) e não
// tem <iframe> em nenhuma página exceto /paginas/ia (ver abaixo).
const CSP_PADRAO = [
    "default-src 'self'",
    SCRIPT_SRC,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    CONNECT_SRC_DEV,
    "frame-src 'none'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
].join('; ');

// /paginas/ia renderiza HTML administrado via Firebird (CLIENTE.CLIENTE_IA)
// que pode conter <iframe> propositalmente, embedando dashboards externos
// com domínio arbitrário definido pelo admin — por isso essa rota, só ela,
// precisa de frame-src permissivo (sanitização de tag/atributo já é feita
// no client com DOMPurify antes do dangerouslySetInnerHTML).
const CSP_PAGINA_IA = [
    "default-src 'self'",
    SCRIPT_SRC,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    CONNECT_SRC_DEV,
    'frame-src https:',
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
].join('; ');

const HEADERS_SEGURANCA_PADRAO = [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Content-Security-Policy', value: CSP_PADRAO },
    ...(process.env.NODE_ENV === 'production'
        ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
        : []),
];

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

    async headers() {
        return [
            {
                source: '/:path*',
                headers: HEADERS_SEGURANCA_PADRAO,
            },
            {
                source: '/paginas/ia',
                headers: [
                    ...HEADERS_SEGURANCA_PADRAO.filter((h) => h.key !== 'Content-Security-Policy'),
                    { key: 'Content-Security-Policy', value: CSP_PAGINA_IA },
                ],
            },
        ];
    },
};

export default nextConfig;
