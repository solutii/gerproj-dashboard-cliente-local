'use client';

import { useAuth } from '@/context/AuthContext';
import { useMutation } from '@tanstack/react-query';

import { memo, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BsChatSquareTextFill } from 'react-icons/bs';
import {
  FaCalendar,
  FaClock,
  FaExclamationTriangle,
  FaHashtag,
  FaUser,
} from 'react-icons/fa';
import {
  FaFileWaveform,
  FaRegCircleCheck,
  FaRegCirclePause,
  FaRegCirclePlay,
  FaRegCircleRight,
  FaRegCircleUser,
  FaRegCircleXmark,
} from 'react-icons/fa6';
import { IoIosSave } from 'react-icons/io';
import { IoClose } from 'react-icons/io5';
import { TbAlertOctagonFilled } from 'react-icons/tb';
import { formatarDataParaBR } from '../../formatters/formatar-data';
import { formatarHora } from '../../formatters/formatar-hora';
import { formatarNumeros } from '../../formatters/formatar-numeros';
import { corrigirTextoCorrompido } from '../../formatters/formatar-texto-corrompido';
import {
  removerAcentos,
  renderizarDoisPrimeirosNomes,
} from '../../formatters/remover-acentuacao';
import { LoadingButton } from '../utils/Loading_Button';
import { TableRowProps } from './Colunas_Tabela';

interface ModalDataProps {
  concordaPagar: boolean;
  observacao: string;
}

interface ModalProps {
  isOpen: boolean;
  selectedRow: TableRowProps | null;
  onClose: () => void;
  onSave: (updatedRow: TableRowProps) => void;
}

const STATUS_CONFIG = {
  finalizado: {
    icon: FaRegCircleCheck,
    color: 'text-emerald-700',
    bg: 'bg-emerald-100',
    border: 'border-emerald-500',
  },
  'aguardando validacao': {
    icon: FaRegCirclePlay,
    color: 'text-purple-700',
    bg: 'bg-purple-100',
    border: 'border-purple-500',
  },
  atribuido: {
    icon: FaRegCircleRight,
    color: 'text-pink-700',
    bg: 'bg-pink-100',
    border: 'border-pink-500',
  },
  standby: {
    icon: FaRegCirclePause,
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    border: 'border-amber-500',
  },
  'em atendimento': {
    icon: FaRegCircleUser,
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    border: 'border-blue-500',
  },
} as const;

const DEFAULT_STATUS = {
  icon: FaRegCircleXmark,
  color: 'text-slate-700',
  bg: 'bg-slate-100',
  border: 'border-slate-500',
};

const getStatusIcon = (status: string) => {
  const statusLower = status?.toLowerCase() || '';
  const matchedStatus = Object.keys(STATUS_CONFIG).find(
    (key) => statusLower.includes(key) || key.includes(statusLower),
  );
  return matchedStatus
    ? STATUS_CONFIG[matchedStatus as keyof typeof STATUS_CONFIG]
    : DEFAULT_STATUS;
};

const StatusBadge = memo(({ status }: { status: string }) => {
  const { icon: Icon, color, bg, border } = getStatusIcon(status);

  return (
    <div
      className={`inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-bold tracking-widest select-none  ${bg} ${color} ${border}`}
    >
      <Icon className="mr-2 h-4 w-4" />
      {status}
    </div>
  );
});

StatusBadge.displayName = 'StatusBadge';

const InfoCard = memo(
  ({
    icon: Icon,
    label,
    value,
    fullWidth = false,
  }: {
    icon: any;
    label: string;
    value: string;
    fullWidth?: boolean;
  }) => (
    <div
      className={`group rounded-md border bg-gradient-to-br from-slate-50 to-white p-4 transition-all shadow-xs shadow-black ${fullWidth ? 'col-span-full' : ''}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon className=" text-slate-800" size={16} />
        <span className="text-xs font-bold text-slate-800 tracking-widest select-none">
          {label}
        </span>
      </div>
      <div className="text-base font-bold text-slate-800 tracking-widest select-none ">
        {value}
      </div>
    </div>
  ),
);

InfoCard.displayName = 'InfoCard';

// Função para salvar validação na API
const saveValidationApi = async ({
  cod_os,
  concordaPagar,
  observacao,
}: {
  cod_os: string | number;
  concordaPagar: boolean;
  observacao: string | null;
}) => {
  const response = await fetch('/api/salvar-validacao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cod_os,
      concordaPagar,
      observacao: observacao ? removerAcentos(observacao) : null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Falha ao salvar validação');
  }

  return response.json();
};

export function ModalChamado({
  isOpen,
  selectedRow,
  onClose,
  onSave,
}: ModalProps) {
  const { isAdmin } = useAuth();

  const [modalData, setModalData] = useState<ModalDataProps>({
    concordaPagar: true,
    observacao: '',
  });
  const [validationError, setValidationError] = useState('');

  // Mutation para salvar validação
  const saveValidationMutation = useMutation({
    mutationFn: saveValidationApi,
    onSuccess: (data, variables) => {
      toast.success('Validação salva com sucesso!');

      if (selectedRow) {
        // Atualiza a linha com o novo valor de validação
        const updatedRow: TableRowProps = {
          ...selectedRow,
          valcli_os: variables.concordaPagar ? 'SIM' : 'NAO',
        };

        // Chama o callback para atualizar a tabela
        onSave(updatedRow);
      }

      // Aguarda um momento para o toast ser exibido antes de fechar
      setTimeout(() => {
        handleClose();
      }, 500);
    },
    onError: (error: Error) => {
      console.error('Erro ao processar validação:', error);
      toast.error(`Erro ao salvar validação: ${error.message}`);
    },
  });

  const handleCheckboxChange = useCallback((checked: boolean) => {
    setModalData((prev) => ({
      ...prev,
      concordaPagar: checked,
    }));
    if (checked) setValidationError('');
  }, []);

  const handleObservacaoChange = useCallback((value: string) => {
    // Remove espaços extras no início
    const trimmed = value.replace(/^\s+/, '');

    // Transforma apenas a primeira letra da primeira palavra em maiúscula
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

    setModalData((prev) => ({
      ...prev,
      observacao: formatted,
    }));
  }, []);

  const validateForm = useCallback((): boolean => {
    if (!modalData.concordaPagar && modalData.observacao.trim() === '') {
      setValidationError('.');
      return false;
    }
    setValidationError('');
    return true;
  }, [modalData.concordaPagar, modalData.observacao]);

  const handleClose = useCallback(() => {
    if (saveValidationMutation.isPending) return;

    if (!modalData.concordaPagar && modalData.observacao.trim() === '') {
      setValidationError(
        'Para salvar a discordância e/ou fechar o formulário, você deve informar o motivo na observação, ou aprovar a OS.',
      );
      return;
    }

    setModalData({ concordaPagar: true, observacao: '' });
    setValidationError('');
    onClose();
  }, [
    saveValidationMutation.isPending,
    modalData.concordaPagar,
    modalData.observacao,
    onClose,
  ]);

  const isFormValid = useCallback(() => {
    return modalData.concordaPagar || modalData.observacao.trim() !== '';
  }, [modalData.concordaPagar, modalData.observacao]);

  const saveModalData = useCallback(async () => {
    if (!selectedRow || !validateForm()) return;

    saveValidationMutation.mutate({
      cod_os: selectedRow.cod_os,
      concordaPagar: modalData.concordaPagar,
      observacao: modalData.observacao.trim() || null,
    });
  }, [
    selectedRow,
    validateForm,
    modalData.concordaPagar,
    modalData.observacao,
    saveValidationMutation,
  ]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !saveValidationMutation.isPending)
        handleClose();
    },
    [saveValidationMutation.isPending, handleClose],
  );

  const handleSubmit = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      saveModalData();
    },
    [saveModalData],
  );

  useEffect(() => {
    if (isOpen && selectedRow) {
      setModalData({ concordaPagar: true, observacao: '' });
      setValidationError('');
    }
  }, [isOpen, selectedRow]);

  if (!isOpen || !selectedRow) return null;

  return (
    <>
      <div className="animate-in fade-in fixed inset-0 z-60 flex items-center justify-center p-4 duration-300">
        {/* ===== OVERLAY ===== */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
        {/* ========== */}

        <div className="animate-in slide-in-from-bottom-4 relative z-10 max-h-[100vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-teal-900 bg-white transition-all duration-500 ease-out">
          {/* ===== HEADER ===== */}
          <header className="relative flex items-center justify-between bg-teal-700 p-6 shadow-xs shadow-black">
            <div className="flex items-center justify-center gap-6">
              <FaFileWaveform className=" text-white" size={60} />
              <div className="flex flex-col">
                <h1 className="text-2xl font-extrabold tracking-widest text-gray-200 select-none">
                  DETALHES DA OS
                </h1>
                <p className="text-lg font-extrabold tracking-widest text-gray-200  select-none">
                  Revise e valide a OS
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={saveValidationMutation.isPending}
              className="group active::scale-95 cursor-pointer rounded-full bg-white/20 p-3 transition-all hover:scale-125 hover:rotate-180 hover:bg-red-500"
            >
              <IoClose className="text-white group-hover:scale-125" size={20} />
            </button>
          </header>
          {/* ===== */}

          {/* Conteúdo do modal */}
          <div className="rounded-b-2xl bg-white p-4 shadow-2xl">
            {/* Grid de informações */}
            <div className="mb-6 grid grid-cols-2 gap-2">
              <InfoCard
                icon={FaHashtag}
                label="Número da OS"
                value={formatarNumeros(selectedRow.cod_os)}
              />
              {/* ===== */}

              <InfoCard
                icon={FaCalendar}
                label="Data"
                value={formatarDataParaBR(selectedRow.dtini_os)}
              />
              {/* ===== */}
              {isAdmin && (
                <InfoCard
                  icon={FaUser}
                  label="Cliente"
                  value={renderizarDoisPrimeirosNomes(selectedRow.nome_cliente)}
                />
              )}
              {/* ===== */}

              <InfoCard
                icon={FaCalendar}
                label="Status"
                value={formatarDataParaBR(
                  selectedRow.status_chamado || 'Sem status',
                )}
              />
              {/* ===== */}

              <InfoCard
                icon={FaClock}
                label="Hora Início"
                value={formatarHora(selectedRow.hrini_os)}
              />
              {/* ===== */}

              <InfoCard
                icon={FaClock}
                label="Hora Fim"
                value={formatarHora(selectedRow.hrfim_os)}
              />
              {/* ===== */}

              <InfoCard
                icon={FaClock}
                label="Tempo Total"
                value={selectedRow.total_horas}
              />
              {/* ===== */}

              <InfoCard
                icon={FaUser}
                label="Consultor"
                value={renderizarDoisPrimeirosNomes(
                  corrigirTextoCorrompido(selectedRow.nome_recurso),
                )}
              />
              {/* ===== */}

              <InfoCard
                icon={BsChatSquareTextFill}
                label="Observação da OS"
                value={corrigirTextoCorrompido(
                  selectedRow.obs || 'Sem observação',
                )}
                fullWidth
              />
            </div>

            {/* Formulário */}
            <div className="flex flex-col gap-4">
              {/* Divisor */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-400"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 font-extrabold text-slate-800 tracking-widest select-none  text-base">
                    Validação
                  </span>
                </div>
              </div>

              {/* Checkbox estilizado */}
              <div
                className={`group relative flex cursor-pointer items-center gap-6 border rounded-md shadow-xs shadow-black ${modalData.concordaPagar ? 'bg-blue-100 border-blue-500' : 'bg-red-100 border-red-500'} px-4 py-2 transition-all hover:shadow-lg hover:shadow-black`}
              >
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={modalData.concordaPagar}
                    onChange={(e) => handleCheckboxChange(e.target.checked)}
                    disabled={saveValidationMutation.isPending}
                    className="h-5 w-5 rounded-md border bg-white transition-all disabled:cursor-not-allowed disabled:opacity-50 shadow-xs shadow-black active:scale-85 hover:shadow-lg hover:shadow-black"
                  />
                </div>
                <div className="flex-1">
                  <span
                    className={`block text-lg font-bold select-none tracking-widest ${
                      modalData.concordaPagar
                        ? 'text-blue-600 font-extrabold'
                        : 'text-red-600 font-extrabold'
                    }`}
                  >
                    {modalData.concordaPagar
                      ? 'OS Aprovada'
                      : 'OS Não Aprovada'}
                  </span>

                  {modalData.concordaPagar && (
                    <span className="text-xs text-slate-700 font-semibold tracking-widest select-none ">
                      Caso não concorde, desmarque e informe o motivo na
                      observação abaixo
                    </span>
                  )}
                </div>
              </div>

              {/* Alerta de discordância */}
              {!modalData.concordaPagar && (
                <div className="animate-in fade-in slide-in-from-top-2 transition-all rounded-md border border-amber-500 bg-amber-100 px-4 py-2">
                  <div className="flex items-center gap-6">
                    <FaExclamationTriangle
                      className=" text-amber-700 animate-pulse"
                      size={32}
                    />
                    <div className="flex-1">
                      <p className="font-bold text-amber-800 tracking-widest select-none text-base">
                        Atenção!
                      </p>
                      <p className="mt-1 text-sm text-amber-800 font-semibold tracking-widest select-none ">
                        Você deve informar o motivo da discordância no campo de
                        observação
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {/* ===== */}

              {/* Campo de observação */}
              <div className="flex flex-col">
                <label
                  htmlFor="observacao"
                  className="mb-1 block text-xs font-bold text-slate-800 tracking-widest select-none"
                >
                  {!modalData.concordaPagar ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-red-600"></div>
                        Observação{' '}
                      </div>
                    </>
                  ) : (
                    <>Observação (Opcional)</>
                  )}
                </label>
                <div className="relative">
                  <textarea
                    id="observacao"
                    value={modalData.observacao}
                    onChange={(e) => handleObservacaoChange(e.target.value)}
                    rows={4}
                    className={`w-full rounded-xl border bg-white px-4 py-2 text-slate-800 tracking-widest placeholder:text-sm placeholder:font-semibold select-none font-semibold transition-all focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 shadow-xs shadow-black hover:shadow-lg hover:shadow-black placeholder:tracking-widest placeholder: placeholder:text-slate-400 ${
                      !modalData.concordaPagar
                        ? 'focus:ring-red-600 focus:shadow-none focus:ring-2 focus:border-none border-red-500'
                        : 'focus:ring-2 focus:ring-blue-600 focus:shadow-none'
                    }`}
                    placeholder={
                      !modalData.concordaPagar
                        ? 'Por favor, informe o motivo da Não Aprovação...'
                        : 'Digite uma observação, se necessário...'
                    }
                    disabled={saveValidationMutation.isPending}
                  />
                </div>
              </div>
              {/* ===== */}

              {/* Mensagem de erro */}
              {validationError && (
                <div className="animate-in fade-in slide-in-from-top-2 transition-all rounded-md border border-red-500 bg-red-100 px-4 py-2">
                  <div className="flex items-center gap-4">
                    <TbAlertOctagonFilled
                      className="text-red-600 animate-pulse"
                      size={28}
                    />
                    <p className="flex-1 text-sm tracking-widest select-none font-semibold text-red-800 ">
                      {validationError}
                    </p>
                  </div>
                </div>
              )}

              {/* Botões de ação */}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end mt-10">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saveValidationMutation.isPending}
                  className="w-[200px] cursor-pointer rounded-md border-none bg-gradient-to-r from-red-600 to-red-700 px-6 py-2 text-lg font-extrabold tracking-widest text-white shadow-xs shadow-black transition-all hover:shadow-lg hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
                {/* ===== */}

                <button
                  type="button"
                  onClick={handleSubmit}
                  className="group relative overflow-hidden w-[200px] cursor-pointer rounded-md border-none bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-2 text-lg font-extrabold tracking-widest text-white shadow-xs shadow-black transition-all hover:shadow-lg hover:shadow-black active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={saveValidationMutation.isPending || !isFormValid()}
                >
                  {saveValidationMutation.isPending ? (
                    <span className="flex items-center justify-center gap-3">
                      <LoadingButton size={24} />
                      Salvando...
                    </span>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <IoIosSave className="mr-2 inline-block" size={24} />
                      <span>Salvar</span>
                    </div>
                  )}
                </button>
              </div>
              {/* ===== */}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
