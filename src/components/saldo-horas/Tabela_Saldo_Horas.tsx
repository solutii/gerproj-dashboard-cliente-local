'use client';

import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { getColunasSaldo, SaldoRowProps } from '../../components/saldo-horas/Colunas_Tabela_Saldo';

// ===== CONFIGURAÇÃO DE ALTURA DA TABELA =====
const ZOOM_LEVEL = 0.67;
const ZOOM_COMPENSATION = 100 / ZOOM_LEVEL;
const HEADER_HEIGHT = 293;
const BASE_MIN_HEIGHT = 400;
const MAX_HEIGHT = `calc(${ZOOM_COMPENSATION}vh - ${HEADER_HEIGHT}px)`;
const MIN_HEIGHT = `${(BASE_MIN_HEIGHT * ZOOM_COMPENSATION) / 100}px`;

interface TabelaSaldoHorasProps {
    historico: SaldoRowProps[];
}

export function TabelaSaldoHoras({ historico }: TabelaSaldoHorasProps) {
    const columns = getColunasSaldo();

    const table = useReactTable({
        data: historico,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
            <div
                className="scrollbar-thin scrollbar-track-purple-100 scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-800 flex-1 overflow-x-auto overflow-y-auto"
                style={{
                    maxHeight: MAX_HEIGHT,
                    minHeight: MIN_HEIGHT,
                }}
            >
                <table
                    className="w-full border-separate border-spacing-0"
                    style={{
                        tableLayout: 'fixed',
                        minWidth: '1400px',
                    }}
                >
                    <thead className="sticky top-0 z-20">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="relative bg-purple-700 p-4 shadow-md shadow-black"
                                    >
                                        {flexRender(
                                            header.column.columnDef.header,
                                            header.getContext()
                                        )}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>

                    <tbody>
                        {table.getRowModel().rows.map((row, idx) => (
                            <tr
                                key={row.id}
                                className={`cursor-pointer transition-all ${
                                    idx % 2 === 0 ? 'bg-white' : 'bg-white'
                                } hover:bg-teal-200`}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <td
                                        key={cell.id}
                                        className="border-b border-gray-500 p-4 transition-all"
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
