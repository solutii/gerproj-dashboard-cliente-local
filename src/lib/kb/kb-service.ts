// lib/kb/kb-service.ts
//
// Base de conhecimento: artigos guardados como arquivos Markdown em
// content/kb/*.md, sem nenhuma dependência de banco de dados. Edição é
// feita direto nos arquivos (novo artigo = novo .md nessa pasta).
import fs from 'fs';
import matter from 'gray-matter';
import path from 'path';

const KB_DIR = path.join(process.cwd(), 'content', 'kb');

export interface ArtigoMeta {
    slug: string;
    title: string;
    categoria: string;
    resumo: string;
}

export interface Artigo extends ArtigoMeta {
    conteudo: string; // markdown puro
}

function listarArquivosMd(): string[] {
    if (!fs.existsSync(KB_DIR)) return [];
    return fs.readdirSync(KB_DIR).filter((f) => f.endsWith('.md'));
}

function lerArquivo(nomeArquivo: string): Artigo {
    const slug = nomeArquivo.replace(/\.md$/, '');
    const caminhoCompleto = path.join(KB_DIR, nomeArquivo);
    const bruto = fs.readFileSync(caminhoCompleto, 'utf8');
    const { data, content } = matter(bruto);

    return {
        slug,
        title: String(data.title ?? slug),
        categoria: String(data.categoria ?? 'Geral'),
        resumo: String(data.resumo ?? ''),
        conteudo: content,
    };
}

export function listarArtigos(): ArtigoMeta[] {
    return listarArquivosMd()
        .map((arquivo) => {
            const { conteudo: _conteudo, ...meta } = lerArquivo(arquivo);
            return meta;
        })
        .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }));
}

export function buscarArtigoPorSlug(slug: string): Artigo | null {
    const nomeArquivo = `${slug}.md`;
    const caminhoCompleto = path.join(KB_DIR, nomeArquivo);

    // Impede path traversal (ex: slug = "../../.env")
    if (!caminhoCompleto.startsWith(KB_DIR) || !fs.existsSync(caminhoCompleto)) {
        return null;
    }

    return lerArquivo(nomeArquivo);
}
