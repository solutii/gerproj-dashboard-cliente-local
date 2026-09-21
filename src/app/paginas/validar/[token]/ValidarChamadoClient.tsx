// src/app/paginas/validar/[token]/ValidarChamadoClient.tsx

'use client';

import { OSRowProps } from '@/app/paginas/chamados/tabelas/Colunas_Tabela_OS';
import { IsLoading } from '@/components/IsLoading';
import { ZOOM_PAGINAS } from '@/components/loading-titles';
import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarHora, formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { alertConfirm, alertError, alertSuccess } from '@/store/useAlertDialogStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { FaCalendar, FaClock, FaHashtag, FaUser } from 'react-icons/fa';
import { FaRegCircleCheck, FaRegCircleXmark } from 'react-icons/fa6';
import { CabecalhoValidacao } from './CabecalhoValidacao';

interface OSResponse {
    success: boolean;
    codChamado: number;
    dataChamado: string | null;
    chamadoFinalizado?: boolean;
    nomeCliente?: string | null;
    data: OSRowProps[];
}

type Ordenacao = 'data-desc' | 'data-asc' | 'os-asc' | 'os-desc' | 'status';

const OPCOES_ORDENACAO: { valor: Ordenacao; rotulo: string }[] = [
    { valor: 'data-desc', rotulo: 'Data: mais recente primeiro' },
    { valor: 'data-asc', rotulo: 'Data: mais antiga primeiro' },
    { valor: 'os-asc', rotulo: 'Nº da OS: crescente' },
    { valor: 'os-desc', rotulo: 'Nº da OS: decrescente' },
    { valor: 'status', rotulo: 'Status: reprovadas primeiro' },
];

function timestamp(data: string): number {
    const t = Date.parse(data);
    return Number.isNaN(t) ? 0 : t;
}

function ordenarOS(lista: OSRowProps[], ordenacao: Ordenacao): OSRowProps[] {
    const porNumero = (a: OSRowProps, b: OSRowProps) => Number(a.NUM_OS) - Number(b.NUM_OS);
    const copia = [...lista];

    switch (ordenacao) {
        case 'data-asc':
            return copia.sort(
                (a, b) => timestamp(a.DTINI_OS) - timestamp(b.DTINI_OS) || porNumero(a, b)
            );
        case 'os-asc':
            return copia.sort(porNumero);
        case 'os-desc':
            return copia.sort((a, b) => porNumero(b, a));
        case 'status': {
            const peso = (os: OSRowProps) => (os.VALCLI_OS === 'NAO' ? 0 : 1);
            return copia.sort(
                (a, b) => peso(a) - peso(b) || timestamp(b.DTINI_OS) - timestamp(a.DTINI_OS)
            );
        }
        case 'data-desc':
        default:
            return copia.sort(
                (a, b) => timestamp(b.DTINI_OS) - timestamp(a.DTINI_OS) || porNumero(b, a)
            );
    }
}

async function fetchOS(codChamado: number, token: string): Promise<OSResponse> {
    const response = await fetch(
        `/api/chamados/${codChamado}/os?token=${encodeURIComponent(token)}`
    );
    if (!response.ok) {
        const erro = await response.json();
        throw new Error(erro.error ?? 'Erro ao buscar OS do chamado');
    }
    return response.json();
}

interface ValidarChamadoClientProps {
    token: string;
    codChamado: number;
    codCliente: string;
}

export function ValidarChamadoClient({ token, codChamado, codCliente }: ValidarChamadoClientProps) {
    const queryClient = useQueryClient();
    const isDesktop = useIsDesktop();
    const [validandoTudo, setValidandoTudo] = useState(false);
    const [ordenacao, setOrdenacao] = useState<Ordenacao>('data-desc');

    const queryKey = useMemo(
        () => ['validar-os', codChamado, codCliente],
        [codChamado, codCliente]
    );
    const { data, isLoading, isError, error } = useQuery({
        queryKey,
        queryFn: () => fetchOS(codChamado, token),
    });

    const osOrdenadas = useMemo(() => ordenarOS(data?.data ?? [], ordenacao), [data, ordenacao]);

    const handleValidarTudo = useCallback(async () => {
        if (validandoTudo) return;
        const qtdReprovadas = data?.data.filter((os) => os.VALCLI_OS === 'NAO').length ?? 0;
        const mensagem =
            qtdReprovadas > 0
                ? `Este chamado tem ${qtdReprovadas} OS reprovada${qtdReprovadas > 1 ? 's' : ''}. Ao validar, TODAS as OS serão aprovadas e ${qtdReprovadas > 1 ? 'as reprovações serão desfeitas' : 'a reprovação será desfeita'}. Para contestar alguma OS, acesse o portal. Confirma?`
                : "Isso vai aprovar TODAS as OS's deste chamado. Confirma?";
        const confirmado = await alertConfirm(mensagem, {
            title: 'Validar chamado',
            confirmText: 'Sim, aprovar tudo',
        });
        if (!confirmado) return;

        setValidandoTudo(true);
        try {
            const res = await fetch(`/api/chamados/${codChamado}/validar-tudo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error ?? 'Erro ao validar chamado');
            }
            alertSuccess('Chamado validado com sucesso!');
            await queryClient.invalidateQueries({ queryKey });
        } catch (err) {
            alertError(err instanceof Error ? err.message : 'Erro ao validar chamado');
        } finally {
            setValidandoTudo(false);
        }
    }, [validandoTudo, data, codChamado, token, queryClient, queryKey]);

    return (
        // Tela inteira sem rolagem própria: cabeçalho + barra de ações ficam fixos e
        // só a lista de OS rola, passando por trás deles.
        <div className="flex h-dvh flex-col overflow-hidden bg-stone-100">
            <div className="flex-shrink-0">
                <CabecalhoValidacao codChamado={codChamado} nomeCliente={data?.nomeCliente} />
            </div>

            <div className="relative z-10 flex-shrink-0 bg-stone-100 shadow-[0_10px_12px_-10px_rgba(0,0,0,0.35)]">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pt-4 pb-3 sm:px-8">
                    {isError && (
                        <p className="text-center text-sm font-semibold tracking-widest text-red-600 select-none">
                            {error instanceof Error
                                ? error.message
                                : 'Erro ao carregar OS do chamado.'}
                        </p>
                    )}

                    {data && data.data.length === 0 && (
                        <p className="text-center text-sm font-semibold tracking-widest text-gray-500 select-none">
                            Nenhuma OS encontrada para este chamado.
                        </p>
                    )}

                    {data?.chamadoFinalizado && (
                        <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs font-bold tracking-wide text-emerald-800 select-none">
                            Este chamado já foi validado e está finalizado. A avaliação está
                            disponível somente para consulta.
                        </p>
                    )}

                    {data && data.data.length > 0 && (
                        <>
                            {(data.data.length > 1 || !data.chamadoFinalizado) && (
                                <div className="flex items-center justify-between gap-3">
                                    {data.data.length > 1 && (
                                        <label
                                            htmlFor="ordenar-os"
                                            className="flex min-w-0 flex-1 items-center gap-2 text-xs font-bold tracking-wide text-gray-600 select-none sm:flex-none"
                                        >
                                            <span className="hidden sm:inline">Ordenar por</span>
                                            <select
                                                id="ordenar-os"
                                                aria-label="Ordenar por"
                                                value={ordenacao}
                                                onChange={(e) =>
                                                    setOrdenacao(e.target.value as Ordenacao)
                                                }
                                                className="min-w-0 flex-1 cursor-pointer rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs font-semibold tracking-wide text-black outline-none focus:border-teal-500 sm:flex-none"
                                            >
                                                {OPCOES_ORDENACAO.map((opcao) => (
                                                    <option key={opcao.valor} value={opcao.valor}>
                                                        {opcao.rotulo}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    )}

                                    {!data.chamadoFinalizado && (
                                        <button
                                            type="button"
                                            onClick={handleValidarTudo}
                                            disabled={validandoTudo}
                                            className="ml-auto flex flex-shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-gradient-to-br from-blue-600 to-blue-700 px-4 py-2 text-xs font-extrabold tracking-wide text-white shadow-sm shadow-black transition-all duration-200 select-none hover:-translate-y-0.5 hover:from-blue-500 hover:to-blue-600 hover:shadow-md hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <FaRegCircleCheck size={14} />
                                            {validandoTudo ? 'Validando...' : 'Validar Chamado'}
                                        </button>
                                    )}
                                </div>
                            )}

                            {!data.chamadoFinalizado && (
                                <p className="text-xs font-semibold tracking-wide text-gray-500 select-none">
                                    Confira {data.data.length > 1 ? "as OS's" : 'a OS'} abaixo. Para
                                    contestar alguma OS, acesse o portal do cliente, ou fale com o
                                    setor responsável.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pt-4 pb-16 sm:px-8">
                    {osOrdenadas.map((os) => (
                        <OSItem key={os.COD_OS} os={os} />
                    ))}
                </div>
            </div>

            {/* Mesmo zoom das demais telas do portal (0.67 no desktop), para o overlay ter o mesmo tamanho. */}
            <div style={{ zoom: isDesktop ? ZOOM_PAGINAS : 1 }}>
                <IsLoading isLoading={isLoading} title="Carregando OS's do chamado..." />
            </div>
        </div>
    );
}

function OSItem({ os }: { os: OSRowProps }) {
    const validada = os.VALCLI_OS === 'SIM' || os.VALCLI_OS === 'NAO';

    return (
        <div className="flex flex-col gap-2.5 rounded-lg border border-gray-200 bg-white p-3 shadow-sm shadow-black/10">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                <Campo icon={FaHashtag} label="OS" value={formatarNumeros(os.NUM_OS)} />
                <Campo icon={FaCalendar} label="Data" value={formatarDataParaBR(os.DTINI_OS)} />
                <Campo
                    icon={FaClock}
                    label="Horário"
                    value={`${formatarHora(os.HRINI_OS)} - ${formatarHora(os.HRFIM_OS)}`}
                />
                <Campo
                    icon={FaClock}
                    label="Total"
                    value={formatarHorasTotaisSufixo(os.TOTAL_HORAS_OS)}
                />
                <Campo icon={FaUser} label="Consultor" value={os.NOME_RECURSO ?? '-'} />
            </div>

            {os.OBS && (
                <p className="text-xs font-medium text-gray-600">
                    <span className="mr-1 font-bold text-gray-800 select-none">Obs:</span>
                    {os.OBS}
                </p>
            )}

            {validada && (
                <div
                    className={`flex w-fit max-w-full items-center gap-1.5 rounded-md border px-2.5 py-1 ${
                        os.VALCLI_OS === 'SIM'
                            ? 'border-emerald-300 bg-emerald-100'
                            : 'border-red-300 bg-red-100'
                    }`}
                >
                    {os.VALCLI_OS === 'SIM' ? (
                        <FaRegCircleCheck className="flex-shrink-0 text-emerald-700" size={13} />
                    ) : (
                        <FaRegCircleXmark className="flex-shrink-0 text-red-700" size={13} />
                    )}
                    <span
                        className={`text-xs font-bold select-none ${
                            os.VALCLI_OS === 'SIM' ? 'text-emerald-800' : 'text-red-800'
                        }`}
                    >
                        {os.VALCLI_OS === 'SIM' ? 'Aprovada' : 'Reprovada'}
                        {os.OBSCLI_OS ? ` — ${os.OBSCLI_OS}` : ''}
                    </span>
                </div>
            )}
        </div>
    );
}

function Campo({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-1.5">
            <Icon className="flex-shrink-0 text-gray-400" size={11} />
            <span className="text-[11px] font-semibold tracking-wide text-gray-500 select-none">
                {label}:
            </span>
            <span className="text-xs font-bold text-black select-none">{value}</span>
        </div>
    );
}
