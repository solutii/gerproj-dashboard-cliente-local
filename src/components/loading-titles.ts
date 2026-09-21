// Títulos dos overlays de carregamento de página — usados tanto pelo Sidebar
// (ao clicar no link) quanto pela própria página (ao buscar os dados), para
// os dois overlays serem idênticos e a troca não piscar.
export const TITULO_LOADING_CHAMADOS = 'Buscando Chamados no banco de dados...';
export const TITULO_LOADING_DASHBOARD = 'Buscando dados do Dashboard no banco de dados...';
export const TITULO_LOADING_BASE_CONHECIMENTO = 'Buscando artigos da Base de Conhecimento...';

// Rotas do Sidebar que mostram o overlay da página assim que se clica.
export const TITULO_LOADING_POR_ROTA: Record<string, string> = {
    '/paginas/chamados': TITULO_LOADING_CHAMADOS,
    '/paginas/dashboard': TITULO_LOADING_DASHBOARD,
    '/paginas/base-conhecimento': TITULO_LOADING_BASE_CONHECIMENTO,
};

// Zoom que os layouts das páginas aplicam no desktop. O overlay que o Sidebar
// mostra ao clicar sai no <body> (fora desse zoom), então precisa repetir o
// mesmo valor para ter o mesmo tamanho do overlay da página.
export const ZOOM_PAGINAS = 0.67;
