// src/app/validar/[token]/ValidarChamadoClient.tsx

'use client';

import { OSRowProps } from '@/app/paginas/chamados/tabelas/Colunas_Tabela_OS';
import { formatarDataParaBR } from '@/formatters/formatar-data';
import { formatarHora, formatarHorasTotaisSufixo } from '@/formatters/formatar-hora';
import { formatarNumeros } from '@/formatters/formatar-numeros';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FaCalendar, FaClock, FaHashtag, FaUser } from 'react-icons/fa';
import { FaFileWaveform, FaRegCircleCheck, FaRegCircleXmark } from 'react-icons/fa6';
import { IoIosSave } from 'react-icons/io';

interface OSResponse {
    success: boolean;
    codChamado: number;
    dataChamado: string | null;
    data: OSRowProps[];
}

async function fetchOS(codChamado: number, codCliente: string): Promise<OSResponse> {
    const response = await fetch(
        `/api/chamados/${codChamado}/os?codCliente=${encodeURIComponent(codCliente)}`
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
    const [validandoTudo, setValidandoTudo] = useState(false);

    const queryKey = useMemo(
        () => ['validar-os', codChamado, codCliente],
        [codChamado, codCliente]
    );
    const { data, isLoading, isError, error } = useQuery({
        queryKey,
        queryFn: () => fetchOS(codChamado, codCliente),
    });

    const handleValidarTudo = useCallback(async () => {
        if (validandoTudo) return;
        const confirmado = window.confirm(
            'Isso vai aprovar TODAS as OS deste chamado, inclusive alguma que já tenha sido reprovada antes. Confirma?'
        );
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
            toast.success('Chamado validado com sucesso!');
            await queryClient.invalidateQueries({ queryKey });
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Erro ao validar chamado');
        } finally {
            setValidandoTudo(false);
        }
    }, [validandoTudo, codChamado, token, queryClient, queryKey]);

    return (
        <div className="min-h-screen bg-stone-100 pb-16">
            <header className="flex flex-col items-center gap-4 bg-teal-700 px-4 py-8 shadow-md shadow-black sm:flex-row sm:justify-between sm:px-10">
                <div className="flex items-center gap-4">
                    <FaFileWaveform className="flex-shrink-0 text-white" size={44} />
                    <div className="flex flex-col gap-1 tracking-widest text-white select-none">
                        <h1 className="text-xl font-extrabold sm:text-2xl">VALIDAÇÃO DE CHAMADO</h1>
                        <p className="text-sm font-semibold">
                            Nº {String(codChamado).padStart(5, '0')}
                        </p>
                    </div>
                </div>
                <Image
                    src="/logo-solutii.png"
                    alt="Solutii"
                    width={120}
                    height={34}
                    priority
                    style={{ width: '120px', height: 'auto' }}
                />
            </header>

            <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-10">
                {isLoading && (
                    <p className="text-center text-sm font-semibold tracking-widest text-gray-500 select-none">
                        Carregando OS's do chamado...
                    </p>
                )}

                {isError && (
                    <p className="text-center text-sm font-semibold tracking-widest text-red-600 select-none">
                        {error instanceof Error ? error.message : 'Erro ao carregar OS do chamado.'}
                    </p>
                )}

                {data && data.data.length === 0 && (
                    <p className="text-center text-sm font-semibold tracking-widest text-gray-500 select-none">
                        Nenhuma OS encontrada para este chamado.
                    </p>
                )}

                {data && data.data.length > 0 && (
                    <>
                        <button
                            type="button"
                            onClick={handleValidarTudo}
                            disabled={validandoTudo}
                            className="flex cursor-pointer items-center justify-center gap-2 self-start rounded-md bg-gradient-to-br from-blue-600 to-blue-700 px-6 py-3 text-sm font-extrabold tracking-widest text-white shadow-md shadow-black transition-all duration-200 select-none hover:-translate-y-1 hover:from-blue-500 hover:to-blue-600 hover:shadow-xl hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <FaRegCircleCheck size={18} />
                            {validandoTudo
                                ? 'Validando...'
                                : 'Validar chamado (aprovar todas as OS)'}
                        </button>

                        <div className="flex flex-col gap-4">
                            {data.data.map((os) => (
                                <OSItem
                                    // Remonta o card (resetando o estado local do
                                    // formulário) sempre que o VALCLI_OS/OBSCLI_OS
                                    // vindos do servidor mudam — sem isso, depois de
                                    // "Validar chamado" ou salvar, o card ficava
                                    // mostrando a seleção/observação antigas mesmo
                                    // com o resumo já refletindo o valor novo.
                                    key={`${os.COD_OS}-${os.VALCLI_OS}-${os.OBSCLI_OS}`}
                                    os={os}
                                    token={token}
                                    onSaved={() => queryClient.invalidateQueries({ queryKey })}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

interface OSItemProps {
    os: OSRowProps;
    token: string;
    onSaved: () => void;
}

function OSItem({ os, token, onSaved }: OSItemProps) {
    const [concordaPagar, setConcordaPagar] = useState(os.VALCLI_OS === 'SIM');
    const [observacao, setObservacao] = useState(os.OBSCLI_OS ?? '');
    const [salvando, setSalvando] = useState(false);

    const jaValidada = os.VALCLI_OS === 'SIM' || os.VALCLI_OS === 'NAO';

    const handleSalvar = useCallback(async () => {
        if (!concordaPagar && !observacao.trim()) {
            toast.error('Informe o motivo da reprovação.');
            return;
        }
        setSalvando(true);
        try {
            const res = await fetch('/api/salvar-validacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cod_os: os.COD_OS,
                    concordaPagar,
                    observacao: observacao.trim() || null,
                    linkToken: token,
                }),
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error ?? 'Falha ao salvar validação');
            }
            toast.success(`OS ${os.NUM_OS ?? os.COD_OS} validada com sucesso!`);
            onSaved();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Erro ao salvar validação');
        } finally {
            setSalvando(false);
        }
    }, [concordaPagar, observacao, os.COD_OS, os.NUM_OS, token, onSaved]);

    return (
        <div className="flex flex-col gap-4 rounded-xl border-t border-gray-200 bg-white p-6 shadow-sm shadow-black">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Campo icon={FaHashtag} label="Número OS" value={formatarNumeros(os.NUM_OS)} />
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
                <Campo icon={FaUser} label="Consultor(a)" value={os.NOME_RECURSO ?? '-'} />
                {jaValidada && (
                    <div className="col-span-2 flex items-center gap-2 sm:col-span-3">
                        {os.VALCLI_OS === 'SIM' ? (
                            <FaRegCircleCheck className="text-emerald-600" size={18} />
                        ) : (
                            <FaRegCircleXmark className="text-red-600" size={18} />
                        )}
                        <span className="text-sm font-bold tracking-widest text-gray-600 select-none">
                            {os.VALCLI_OS === 'SIM' ? 'Já validada como aprovada' : 'Já reprovada'}
                            {os.OBSCLI_OS ? ` — ${os.OBSCLI_OS}` : ''}
                        </span>
                    </div>
                )}
            </div>

            {os.OBS && (
                <p className="text-sm font-semibold tracking-wide text-gray-600">{os.OBS}</p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                    type="button"
                    onClick={() => setConcordaPagar(true)}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border-t px-4 py-3 shadow-sm shadow-black transition-all duration-200 ${
                        concordaPagar
                            ? 'border-blue-500 bg-blue-100 ring-2 ring-blue-500'
                            : 'border-blue-200 bg-white hover:bg-blue-50'
                    }`}
                >
                    <FaRegCircleCheck
                        className={concordaPagar ? 'text-blue-700' : 'text-blue-400'}
                        size={18}
                    />
                    <span className="text-sm font-bold tracking-widest text-blue-700 select-none">
                        OS Aprovada
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setConcordaPagar(false)}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border-t px-4 py-3 shadow-sm shadow-black transition-all duration-200 ${
                        !concordaPagar
                            ? 'border-red-500 bg-red-100 ring-2 ring-red-500'
                            : 'border-red-200 bg-white hover:bg-red-50'
                    }`}
                >
                    <FaRegCircleXmark
                        className={!concordaPagar ? 'text-red-700' : 'text-red-400'}
                        size={18}
                    />
                    <span className="text-sm font-bold tracking-widest text-red-700 select-none">
                        OS Reprovada
                    </span>
                </button>
            </div>

            <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                maxLength={195}
                placeholder={
                    !concordaPagar
                        ? 'Por favor, informe o motivo da reprovação...'
                        : 'Observação opcional...'
                }
                className={`w-full rounded-md px-4 py-2 text-sm font-medium tracking-wide text-black shadow-sm shadow-black outline-none placeholder:text-gray-400 ${
                    !concordaPagar ? 'bg-red-50' : 'bg-blue-50'
                }`}
            />

            <button
                type="button"
                onClick={handleSalvar}
                disabled={salvando}
                className="flex cursor-pointer items-center justify-center gap-2 self-end rounded-md bg-gradient-to-br from-teal-600 to-teal-700 px-5 py-2 text-sm font-extrabold tracking-widest text-white shadow-md shadow-black transition-all duration-200 select-none hover:-translate-y-1 hover:shadow-xl hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
                <IoIosSave size={18} />
                {salvando ? 'Salvando...' : 'Salvar'}
            </button>
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
        <div>
            <div className="mb-1 flex items-center gap-1.5">
                <Icon className="text-gray-500" size={12} />
                <span className="text-xs font-bold tracking-widest text-gray-500 select-none">
                    {label}
                </span>
            </div>
            <span className="text-sm font-bold tracking-wide text-black select-none">{value}</span>
        </div>
    );
}
