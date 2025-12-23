'use client';

import { TabelaSaldoHoras } from '@/components/saldo-horas/Tabela_Saldo_Horas';
import { SaldoRowProps } from '@/components/saldo-horas/Colunas_Tabela_Saldo';
import { useAuth } from '@/context/AuthContext';
import { useFilters } from '@/context/FiltersContext';
import { useQuery } from '@tanstack/react-query';
import { FaExclamationTriangle } from 'react-icons/fa';
import { IoClose, IoTimeOutline } from 'react-icons/io5';
import { useEffect } from 'react';

interface ApiResponse {
  mesAtual: number;
  anoAtual: number;
  codCliente: string;
  nomeCliente: string;
  saldoTotalDisponivel: number;
  debitoTotal: number;
  resumo: {
    totalContratadas: number;
    totalExecutadas: number;
    saldoGeral: number;
    mesesComSaldoPositivo: number;
    mesesComSaldoNegativo: number;
    mesesExpirados: number;
  };
  historico: SaldoRowProps[];
}

interface ModalSaldoHorasProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ModalSaldoHoras({ isOpen, onClose }: ModalSaldoHorasProps) {
  const { isAdmin, codCliente } = useAuth();
  const { filters } = useFilters();

  // Fecha modal com ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // Previne scroll do body quando modal está aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const fetchData = async (): Promise<ApiResponse> => {
    const clienteParam = !isAdmin && codCliente ? codCliente : filters.cliente;

    if (!clienteParam) {
      throw new Error('Cliente não selecionado');
    }

    const params = new URLSearchParams({
      codCliente: clienteParam,
      mes: (filters.mes || new Date().getMonth() + 1).toString(),
      ano: (filters.ano || new Date().getFullYear()).toString(),
      isAdmin: isAdmin.toString(),
      mesesHistorico: '6',
    });

    const response = await fetch(`/api/saldo-horas?${params.toString()}`);

    if (!response.ok) throw new Error('Erro ao carregar dados');

    return response.json();
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['saldoHoras', filters, isAdmin, codCliente],
    queryFn: fetchData,
    enabled: isOpen && ((isAdmin && !!filters.cliente) || (!isAdmin && !!codCliente)),
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-[1700px] max-h-[100vh] h-full bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-4">
            <IoTimeOutline className="text-purple-600 flex-shrink-0" size={40} />
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-widest text-gray-900">
                SALDO DE HORAS
              </h2>
              {data && (
                <p className="text-xs sm:text-sm font-semibold text-gray-600 tracking-wide mt-1">
                  {data.nomeCliente} • {data.mesAtual.toString().padStart(2, '0')}/{data.anoAtual}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 hover:bg-red-200 transition-colors active:scale-90"
            aria-label="Fechar modal"
          >
            <IoClose className="text-red-600" size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600"></div>
              <span className="text-lg font-bold text-slate-600">
                Carregando saldo de horas...
              </span>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <FaExclamationTriangle className="text-red-500" size={48} />
              <span className="text-lg font-bold text-slate-600">
                {error instanceof Error ? error.message : 'Erro ao carregar dados'}
              </span>
            </div>
          )}

          {data && !isLoading && !isError && (
            <div className="flex flex-col gap-4 sm:gap-6">
              {/* Tabela */}
              <TabelaSaldoHoras historico={data.historico} />

              {/* Info sobre expiração */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <FaExclamationTriangle
                  className="text-blue-600 mt-1 flex-shrink-0"
                  size={20}
                />
                <div className="text-sm text-blue-900">
                  <p className="font-bold mb-1">📌 Regras de Saldo:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>
                      O saldo (positivo ou negativo) pode ser utilizado em até{' '}
                      <strong>2 meses posteriores</strong> ao mês apurado
                    </li>
                    <li>
                      Após <strong>2 meses</strong>, o saldo expira e não pode mais ser
                      compensado
                    </li>
                    <li>
                      Exemplo: Saldo de <strong>10/2025</strong> pode ser usado em{' '}
                      <strong>11/2025</strong> e <strong>12/2025</strong>
                    </li>
                    <li>
                      Saldos <strong className="text-emerald-700">positivos</strong>{' '}
                      indicam horas disponíveis para uso futuro
                    </li>
                    <li>
                      Saldos{' '}
                      <strong className="text-orange-700">negativos (débitos)</strong>{' '}
                      indicam horas excedentes que precisam ser pagas e{' '}
                      <strong>não expiram</strong>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer (opcional) */}
        <div className="flex justify-end p-4 sm:p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex-shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors active:scale-95"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}