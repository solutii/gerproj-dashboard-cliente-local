// src/components/abrir-chamado/Modal_Abrir_Chamado.tsx

'use client';

import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useAuthStore } from '@/store/useAuthStore';
import { useEffect, useRef, useState } from 'react';
import { FaCheckCircle, FaFileExcel, FaFilePdf, FaFileWord, FaImage } from 'react-icons/fa';
import { FiChevronDown, FiFile, FiLoader, FiPaperclip, FiSearch } from 'react-icons/fi';
import { IoClose } from 'react-icons/io5';
import { PiTimerFill } from 'react-icons/pi';

// O modal vive dentro do wrapper com zoom:0.67 usado nas páginas — 1vh aqui
// renderiza ~33% menor do que parece. Compensa igual ao ZOOM_COMPENSATION dos
// layouts, senão o modal fica pequeno mesmo pedindo quase 100vh.
const ZOOM_LEVEL = 0.67;

const inputClass =
    'w-full border-0 border-b border-gray-300 bg-white pb-1.5 text-base tracking-widest text-black outline-none transition-all duration-100 placeholder:text-gray-400 placeholder:text-sm focus:border-b-[3px] focus:border-teal-600';

const labelClass =
    'block select-none text-sm font-semibold tracking-wider text-black uppercase mb-1.5';

const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
];
const MAX_SIZE_MB = 10;
const MAX_FILES = 5;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Preposições/artigos que ficam minúsculos no nome, exceto quando são a primeira palavra.
const CONECTIVOS_NOME = ['da', 'de', 'di', 'do', 'du', 'das', 'des', 'dis', 'dos', 'dus'];

function capitalizarNome(texto: string): string {
    return texto
        .split(' ')
        .map((palavra, i) => {
            if (!palavra) return palavra;
            const minuscula = palavra.toLowerCase();
            if (i > 0 && CONECTIVOS_NOME.includes(minuscula)) return minuscula;
            return minuscula.charAt(0).toUpperCase() + minuscula.slice(1);
        })
        .join(' ');
}

// Capitaliza a primeira letra do texto e a primeira letra após cada ponto final.
function capitalizarFrases(texto: string): string {
    if (!texto) return texto;
    const comPrimeiraMaiuscula = texto.charAt(0).toUpperCase() + texto.slice(1);
    return comPrimeiraMaiuscula.replace(
        /([.!?]\s+)([a-zà-ÿ])/g,
        (_, separador, letra) => separador + letra.toUpperCase()
    );
}

// Máscara de celular brasileiro: (00) 00000-0000 — limita a 11 dígitos.
function formatarTelefone(valor: string): string {
    const digitos = valor.replace(/\D/g, '').slice(0, 11);
    if (digitos.length === 0) return '';
    if (digitos.length <= 2) return `(${digitos}`;
    const ddd = digitos.slice(0, 2);
    const resto = digitos.slice(2);
    if (resto.length <= 5) return `(${ddd}) ${resto}`;
    return `(${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
}

interface Opcao {
    cod: number;
    nome: string;
}

interface OpcoesFormulario {
    departamentos: Opcao[];
    areas: Opcao[];
    classificacoes: Opcao[];
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string) {
    if (type.startsWith('image/')) return FaImage;
    if (type === 'application/pdf') return FaFilePdf;
    if (type.includes('word')) return FaFileWord;
    if (type.includes('excel') || type.includes('spreadsheet')) return FaFileExcel;
    return FiFile;
}

// ─── SeletorBusca ─────────────────────────────────────────────────────────────
// Dropdown customizado com busca, usado para Departamento, Módulo e Tipo de solicitação.
function SeletorBusca({
    label,
    placeholder,
    opcoes,
    loading,
    valorSelecionado,
    onSelecionar,
}: {
    label: string;
    placeholder: string;
    opcoes: Opcao[];
    loading: boolean;
    valorSelecionado: Opcao | null;
    onSelecionar: (opcao: Opcao) => void;
}) {
    const [aberto, setAberto] = useState(false);
    const [busca, setBusca] = useState('');
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickFora(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setAberto(false);
                setBusca('');
            }
        }
        document.addEventListener('mousedown', handleClickFora);
        return () => document.removeEventListener('mousedown', handleClickFora);
    }, []);

    const filtradas = opcoes.filter((o) => o.nome.toLowerCase().includes(busca.toLowerCase()));

    return (
        <div ref={ref}>
            <label className={labelClass}>{label}</label>
            <button
                type="button"
                onClick={() => {
                    if (!loading) setAberto((v) => !v);
                }}
                className={`flex w-full items-center justify-between ${inputClass}`}
            >
                <span className={valorSelecionado ? 'text-black' : 'text-gray-400'}>
                    {loading ? 'Carregando...' : (valorSelecionado?.nome ?? placeholder)}
                </span>
                <FiChevronDown
                    size={16}
                    className={`shrink-0 text-gray-400 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
                />
            </button>

            {aberto && (
                <div className="relative z-50">
                    <div className="absolute top-1 right-0 left-0 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
                        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
                            <FiSearch size={14} className="shrink-0 text-gray-400" />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Buscar..."
                                value={busca}
                                onChange={(e) => setBusca(e.target.value)}
                                className="w-full bg-transparent text-sm tracking-wider text-black outline-none placeholder:text-gray-300"
                            />
                        </div>
                        <ul className="max-h-44 overflow-y-auto">
                            {filtradas.map((o) => (
                                <li
                                    key={o.cod}
                                    onClick={() => {
                                        onSelecionar(o);
                                        setAberto(false);
                                        setBusca('');
                                    }}
                                    className={`cursor-pointer px-4 py-2 text-sm tracking-wider transition-colors hover:bg-teal-50 hover:text-teal-700 ${
                                        valorSelecionado?.cod === o.cod
                                            ? 'bg-teal-100 font-semibold text-teal-700'
                                            : 'text-gray-700'
                                    }`}
                                >
                                    {o.nome}
                                </li>
                            ))}
                            {filtradas.length === 0 && (
                                <li className="px-4 py-3 text-center text-sm text-gray-400">
                                    Nenhum resultado encontrado
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

interface ModalAbrirChamadoProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ModalAbrirChamado({ isOpen, onClose }: ModalAbrirChamadoProps) {
    const { codCliente, loginType, tipoUsuario } = useAuthStore();
    const isAdmin = loginType === 'consultor' && tipoUsuario === 'ADM';
    const isDesktop = useIsDesktop();

    const [solicitante, setSolicitante] = useState('');
    const [email, setEmail] = useState('');
    const [telefone, setTelefone] = useState('');
    const [rotina, setRotina] = useState('');
    const [assunto, setAssunto] = useState('');
    const [solicitacao, setSolicitacao] = useState('');
    const [arquivos, setArquivos] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState('');
    const [codChamadoCriado, setCodChamadoCriado] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Opções dos dropdowns ──
    const [opcoes, setOpcoes] = useState<OpcoesFormulario>({
        departamentos: [],
        areas: [],
        classificacoes: [],
    });
    const [loadingOpcoes, setLoadingOpcoes] = useState(true);
    const [departamento, setDepartamento] = useState<Opcao | null>(null);
    const [area, setArea] = useState<Opcao | null>(null);
    const [classificacao, setClassificacao] = useState<Opcao | null>(null);

    // ── Somente ADM: cliente/recurso/tarefa em nome de quem o chamado é aberto ──
    // O cliente NÃO é escolhido aqui — vem do useAuthStore (definido no login e
    // atualizado pelos Filtros do dashboard via setAdminCodCliente). O dropdown
    // fica travado, só refletindo esse valor.
    const [clientesAtivos, setClientesAtivos] = useState<Opcao[]>([]);
    const [recursosAtivos, setRecursosAtivos] = useState<Opcao[]>([]);
    const [loadingClientesRecursos, setLoadingClientesRecursos] = useState(false);
    const [recursoSelecionado, setRecursoSelecionado] = useState<Opcao | null>(null);
    const [tarefas, setTarefas] = useState<Opcao[]>([]);
    const [loadingTarefas, setLoadingTarefas] = useState(false);
    const [tarefaSelecionada, setTarefaSelecionada] = useState<Opcao | null>(null);

    const clienteAtual = clientesAtivos.find((c) => String(c.cod) === codCliente) ?? null;

    const resetFormulario = () => {
        setSolicitante('');
        setEmail('');
        setTelefone('');
        setRotina('');
        setDepartamento(null);
        setArea(null);
        setClassificacao(null);
        setAssunto('');
        setSolicitacao('');
        setArquivos([]);
        setErro('');
        setCodChamadoCriado(null);
        setRecursoSelecionado(null);
    };

    useEffect(() => {
        if (!isOpen) return;
        resetFormulario();

        setLoadingOpcoes(true);
        fetch('/api/chamados/opcoes')
            .then((r) => r.json())
            .then((data: OpcoesFormulario) => setOpcoes(data))
            .catch(() => {})
            .finally(() => setLoadingOpcoes(false));
    }, [isOpen]);

    // Carrega clientes/recursos ativos só quando o modal abre pra um ADM
    useEffect(() => {
        if (!isOpen || !isAdmin) return;

        setLoadingClientesRecursos(true);
        Promise.all([
            fetch('/api/clientes-ativos').then((r) => r.json()),
            fetch('/api/recursos-ativos').then((r) => r.json()),
        ])
            .then(([clientes, recursos]: [Opcao[], Opcao[]]) => {
                setClientesAtivos(clientes);
                setRecursosAtivos(recursos);
            })
            .catch(() => {})
            .finally(() => setLoadingClientesRecursos(false));
    }, [isOpen, isAdmin]);

    // Busca as tarefas do cliente atual (ADM) sempre que o modal abre ou o
    // cliente muda (inclusive enquanto o modal está fechado, via Filtros do
    // dashboard) — assim a lista já está atualizada quando o modal reabre.
    useEffect(() => {
        if (!isOpen || !isAdmin || !clienteAtual) {
            setTarefas([]);
            setTarefaSelecionada(null);
            return;
        }

        setTarefaSelecionada(null);
        setLoadingTarefas(true);
        fetch(`/api/chamados/tarefas?codCliente=${clienteAtual.cod}`)
            .then((r) => r.json())
            .then((data: Opcao[]) => setTarefas(data))
            .catch(() => setTarefas([]))
            .finally(() => setLoadingTarefas(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, isAdmin, clienteAtual?.cod]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : 'unset';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    const addFiles = (novos: FileList | File[]) => {
        const lista = Array.from(novos);
        const erros: string[] = [];
        const validos: File[] = [];
        for (const f of lista) {
            if (!ALLOWED_TYPES.includes(f.type)) {
                erros.push(`"${f.name}" — tipo não permitido.`);
                continue;
            }
            if (f.size > MAX_SIZE_MB * 1024 * 1024) {
                erros.push(`"${f.name}" — excede ${MAX_SIZE_MB}MB.`);
                continue;
            }
            validos.push(f);
        }
        setArquivos((prev) => {
            const combinados = [...prev, ...validos];
            if (combinados.length > MAX_FILES) {
                erros.push(`Máximo de ${MAX_FILES} arquivos.`);
                return prev;
            }
            return combinados;
        });
        if (erros.length > 0) setErro(erros.join(' '));
    };

    const removeArquivo = (index: number) =>
        setArquivos((prev) => prev.filter((_, i) => i !== index));

    const handleFecharLimpar = () => {
        resetFormulario();
        onClose();
    };

    const handleSubmit = async () => {
        setErro('');
        if (isAdmin) {
            if (!clienteAtual) {
                setErro('Nenhum cliente selecionado. Escolha um cliente nos filtros do dashboard.');
                return;
            }
        } else if (!codCliente) {
            setErro('Nenhum cliente selecionado. Faça login novamente ou selecione um cliente.');
            return;
        }
        if (!solicitante.trim()) {
            setErro('Informe o nome do solicitante.');
            return;
        }
        if (!email.trim()) {
            setErro('Informe o e-mail do solicitante.');
            return;
        }
        if (!EMAIL_REGEX.test(email.trim())) {
            setErro('Informe um e-mail válido.');
            return;
        }
        if (!telefone.trim()) {
            setErro('Informe o telefone do solicitante.');
            return;
        }
        if (!departamento) {
            setErro('Selecione o departamento.');
            return;
        }
        if (!area) {
            setErro('Selecione o módulo.');
            return;
        }
        if (!classificacao) {
            setErro('Selecione o tipo de solicitação.');
            return;
        }
        if (!assunto.trim()) {
            setErro('Informe o assunto do chamado.');
            return;
        }
        if (!solicitacao.trim()) {
            setErro('Descreva a sua solicitação.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/chamados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assunto,
                    solicitacao,
                    codCliente,
                    solicitante,
                    email,
                    telefone,
                    codDepartamento: departamento.cod,
                    codArea: area.cod,
                    rotina,
                    codClassificacao: classificacao.cod,
                    codClienteSelecionado: isAdmin ? clienteAtual?.cod : undefined,
                    codRecursoSelecionado: isAdmin ? recursoSelecionado?.cod : undefined,
                    codTarefaSelecionada: isAdmin ? tarefaSelecionada?.cod : undefined,
                }),
            });
            if (!res.ok) {
                const d = await res.json();
                setErro(d.error ?? 'Erro ao abrir chamado.');
                return;
            }
            const { cod_chamado } = await res.json();

            if (arquivos.length > 0) {
                const formData = new FormData();
                formData.append('cod_chamado', String(cod_chamado));
                arquivos.forEach((f) => formData.append('arquivos', f));
                const uploadRes = await fetch('/api/chamados/upload', {
                    method: 'POST',
                    body: formData,
                });
                if (!uploadRes.ok) {
                    const d = await uploadRes.json();
                    setErro(`Chamado aberto, mas houve um erro ao enviar os anexos: ${d.error}`);
                    setCodChamadoCriado(cod_chamado);
                    return;
                }
            }

            setCodChamadoCriado(cod_chamado);
        } catch {
            setErro('Falha de conexão. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center p-2 transition-all duration-200 ease-out sm:p-4">
            {/* OVERLAY */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={handleFecharLimpar}
            />

            <div
                style={{ height: isDesktop ? `${92 / ZOOM_LEVEL}vh` : '92vh' }}
                className="animate-in slide-in-from-bottom-4 relative z-10 flex w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white transition-all duration-200 ease-out"
            >
                {/* ========== HEADER ========== */}
                <header className="relative flex flex-shrink-0 items-center justify-between bg-teal-700 p-3 shadow-md shadow-black sm:p-5">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <PiTimerFill
                            className="flex-shrink-0 text-white"
                            size={isDesktop ? 44 : 28}
                        />
                        <div className="flex flex-col gap-1 tracking-widest text-white select-none">
                            <h1 className="text-lg font-extrabold sm:text-3xl">ABRIR CHAMADO</h1>
                            {isAdmin && (
                                <span className="text-xs font-semibold tracking-wider text-teal-100 sm:text-sm">
                                    {loadingClientesRecursos
                                        ? 'Carregando cliente...'
                                        : (clienteAtual?.nome ?? 'Nenhum cliente selecionado')}
                                </span>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleFecharLimpar}
                        disabled={loading}
                        className="mr-1 flex-shrink-0 cursor-pointer rounded-md bg-gradient-to-br from-red-600 to-red-700 shadow-md shadow-black transition-all duration-200 hover:scale-125 hover:bg-red-500 hover:shadow-xl hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Fechar modal"
                    >
                        <IoClose className="text-white" size={isDesktop ? 34 : 24} />
                    </button>
                </header>

                {/* ========== CONTEÚDO ========== */}
                <div className="flex flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-14 sm:py-10">
                    {codChamadoCriado ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-10">
                            <FaCheckCircle className="text-teal-600" size={56} />
                            <h2 className="text-center text-2xl font-extrabold tracking-widest text-black select-none">
                                Chamado aberto com sucesso!
                            </h2>
                            <p className="text-center text-sm font-semibold tracking-wider text-gray-500 select-none">
                                Nº do chamado:{' '}
                                <span className="text-teal-700">
                                    {String(codChamadoCriado).padStart(5, '0')}
                                </span>
                            </p>
                            <div className="mt-4 flex gap-4">
                                <button
                                    onClick={resetFormulario}
                                    className="cursor-pointer rounded-md bg-teal-600 px-6 py-2 font-semibold text-white shadow-md shadow-black transition-all duration-300 hover:-translate-y-1 hover:bg-teal-500 hover:shadow-none active:scale-95"
                                >
                                    Abrir outro chamado
                                </button>
                                <button
                                    onClick={handleFecharLimpar}
                                    className="cursor-pointer rounded-md bg-gray-200 px-6 py-2 font-semibold text-black shadow-md shadow-black transition-all duration-300 hover:-translate-y-1 hover:bg-gray-300 hover:shadow-none active:scale-95"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Cliente / Recurso / Tarefa — somente ADM */}
                            {isAdmin && (
                                <>
                                    <div className="mb-7 grid grid-cols-1 gap-7 sm:grid-cols-2">
                                        <div>
                                            <label className={labelClass}>Cliente:</label>
                                            <div
                                                className={`${inputClass} cursor-not-allowed text-gray-500`}
                                            >
                                                {loadingClientesRecursos
                                                    ? 'Carregando...'
                                                    : (clienteAtual?.nome ??
                                                      'Nenhum cliente selecionado')}
                                            </div>
                                        </div>
                                        <SeletorBusca
                                            label="Recurso: (opcional)"
                                            placeholder="Selecione o recurso responsável"
                                            opcoes={recursosAtivos}
                                            loading={loadingClientesRecursos}
                                            valorSelecionado={recursoSelecionado}
                                            onSelecionar={setRecursoSelecionado}
                                        />
                                    </div>

                                    <div className="mb-7">
                                        <SeletorBusca
                                            label="Tarefa: (opcional)"
                                            placeholder={
                                                !clienteAtual
                                                    ? 'Selecione um cliente primeiro'
                                                    : 'Selecione a tarefa'
                                            }
                                            opcoes={tarefas}
                                            loading={loadingTarefas}
                                            valorSelecionado={tarefaSelecionada}
                                            onSelecionar={setTarefaSelecionada}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Solicitante / Email / Telefone */}
                            <div className="mb-7 grid grid-cols-1 gap-7 sm:grid-cols-3">
                                <div>
                                    <label className={labelClass}>Solicitante:</label>
                                    <input
                                        type="text"
                                        value={solicitante}
                                        onChange={(e) => {
                                            setSolicitante(capitalizarNome(e.target.value));
                                            if (erro) setErro('');
                                        }}
                                        maxLength={50}
                                        placeholder="Nome completo"
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>E-mail:</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            if (erro) setErro('');
                                        }}
                                        maxLength={250}
                                        placeholder="seuemail@empresa.com"
                                        className={inputClass}
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Telefone:</label>
                                    <input
                                        type="tel"
                                        value={telefone}
                                        onChange={(e) => {
                                            setTelefone(formatarTelefone(e.target.value));
                                            if (erro) setErro('');
                                        }}
                                        maxLength={15}
                                        placeholder="(00) 00000-0000"
                                        className={inputClass}
                                    />
                                </div>
                            </div>

                            {/* Departamento / Módulo */}
                            <div className="mb-7 grid grid-cols-1 gap-7 sm:grid-cols-2">
                                <SeletorBusca
                                    label="Departamento:"
                                    placeholder="Selecione o departamento"
                                    opcoes={opcoes.departamentos}
                                    loading={loadingOpcoes}
                                    valorSelecionado={departamento}
                                    onSelecionar={(o) => {
                                        setDepartamento(o);
                                        if (erro) setErro('');
                                    }}
                                />
                                <SeletorBusca
                                    label="Módulo:"
                                    placeholder="Selecione o módulo"
                                    opcoes={opcoes.areas}
                                    loading={loadingOpcoes}
                                    valorSelecionado={area}
                                    onSelecionar={(o) => {
                                        setArea(o);
                                        if (erro) setErro('');
                                    }}
                                />
                            </div>

                            {/* Rotina / Tipo de solicitação */}
                            <div className="mb-7 grid grid-cols-1 gap-7 sm:grid-cols-2">
                                <div>
                                    <label className={labelClass}>
                                        Rotina:{' '}
                                        <span className="font-mono text-xs tracking-widest text-gray-400 select-none">
                                            (opcional)
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={rotina}
                                        onChange={(e) =>
                                            setRotina(capitalizarFrases(e.target.value))
                                        }
                                        maxLength={150}
                                        placeholder="Rotina relacionada"
                                        className={inputClass}
                                    />
                                </div>
                                <SeletorBusca
                                    label="Tipo de solicitação:"
                                    placeholder="Selecione o tipo"
                                    opcoes={opcoes.classificacoes}
                                    loading={loadingOpcoes}
                                    valorSelecionado={classificacao}
                                    onSelecionar={(o) => {
                                        setClassificacao(o);
                                        if (erro) setErro('');
                                    }}
                                />
                            </div>

                            {/* Assunto */}
                            <div className="mb-5">
                                <label className={labelClass}>Assunto:</label>
                                <input
                                    type="text"
                                    value={assunto}
                                    onChange={(e) => {
                                        setAssunto(e.target.value);
                                        if (erro) setErro('');
                                    }}
                                    maxLength={150}
                                    placeholder="Informe o assunto do chamado..."
                                    className={inputClass}
                                />
                                <div className="mt-1 flex justify-end">
                                    <span
                                        className={`font-mono text-xs tracking-widest select-none ${assunto.length > 0 ? 'text-black' : 'text-gray-400'}`}
                                    >
                                        {assunto.length}/150
                                    </span>
                                </div>
                            </div>

                            {/* Descrição */}
                            <div className="mb-5">
                                <label className={labelClass}>Descrição:</label>
                                <textarea
                                    value={solicitacao}
                                    onChange={(e) => {
                                        setSolicitacao(capitalizarFrases(e.target.value));
                                        if (erro) setErro('');
                                    }}
                                    placeholder="Descreva detalhadamente o problema ou a sua necessidade..."
                                    rows={8}
                                    className={`${inputClass} resize-none rounded-md border border-gray-300 p-4 focus:border-[1px]`}
                                />
                            </div>

                            {/* Anexos */}
                            <div className="mb-8">
                                <label className={labelClass}>
                                    Anexos:{' '}
                                    <span className="font-mono text-xs tracking-widest text-gray-400 select-none">
                                        (opcional — máx. {MAX_FILES} arquivos, {MAX_SIZE_MB}MB cada)
                                    </span>
                                </label>

                                <div
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDragging(true);
                                    }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDragging(false);
                                        if (e.dataTransfer.files.length > 0)
                                            addFiles(e.dataTransfer.files);
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-4 text-center transition-all duration-100 ${
                                        dragging
                                            ? 'border-teal-600'
                                            : 'border-gray-300 hover:border-teal-600'
                                    }`}
                                >
                                    <FiPaperclip className="mb-2 text-gray-400" size={20} />
                                    <p className="mb-1 text-sm tracking-wider text-gray-400 select-none">
                                        Arraste ou{' '}
                                        <span className="font-semibold text-teal-700">
                                            clique para selecionar
                                        </span>
                                    </p>
                                    <p className="text-xs tracking-widest text-gray-400 select-none">
                                        PNG · JPG · PDF · DOC · XLS · TXT
                                    </p>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept={ALLOWED_TYPES.join(',')}
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files) addFiles(e.target.files);
                                            e.target.value = '';
                                        }}
                                    />
                                </div>

                                {arquivos.length > 0 && (
                                    <div className="mt-2 flex max-h-60 flex-col gap-2 overflow-y-auto pr-1">
                                        {arquivos.map((f, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 py-1 text-sm transition-all duration-100 focus-within:border-teal-600 hover:border-teal-600"
                                            >
                                                <div className="flex items-center gap-4 overflow-hidden">
                                                    {(() => {
                                                        const Icon = fileIcon(f.type);
                                                        return (
                                                            <Icon
                                                                className="shrink-0 text-base text-black"
                                                                size={16}
                                                            />
                                                        );
                                                    })()}
                                                    <div className="overflow-hidden">
                                                        <p className="max-w-[280px] truncate text-xs font-medium tracking-wider text-black select-none">
                                                            {f.name}
                                                        </p>
                                                        <p className="text-[10px] tracking-widest text-black select-none">
                                                            {formatBytes(f.size)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeArquivo(i);
                                                    }}
                                                    className="group shrink-0 cursor-pointer text-gray-400"
                                                >
                                                    <IoClose
                                                        className="transition-all duration-300 group-hover:scale-150 group-hover:rotate-180 group-hover:text-red-500"
                                                        size={16}
                                                    />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Erro */}
                            {erro && (
                                <p className="mb-5 flex rounded-lg border border-red-500/50 bg-red-500/20 px-4 py-1 text-xs font-semibold tracking-wider text-red-500 select-none">
                                    ⚠ {erro}
                                </p>
                            )}

                            {/* Botões */}
                            <div className="flex gap-4">
                                <button
                                    onClick={handleFecharLimpar}
                                    disabled={loading}
                                    className="flex flex-1 items-center justify-center rounded-md bg-red-600 py-2 font-semibold text-white shadow-md shadow-black transition-all duration-300 hover:-translate-y-1 hover:bg-red-400 hover:shadow-none active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="flex flex-1 items-center justify-center gap-3 rounded-md bg-teal-700 py-2 font-semibold text-white shadow-md shadow-black transition-all duration-300 hover:-translate-y-1 hover:bg-teal-600 hover:shadow-none active:scale-95 disabled:cursor-not-allowed disabled:bg-teal-400 disabled:shadow-none"
                                >
                                    {loading ? (
                                        <>
                                            <FiLoader className="animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        'Abrir Chamado'
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
