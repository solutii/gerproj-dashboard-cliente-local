'use client';

import { getColunasSaldo, SaldoRowProps } from '@/components/saldo-horas/Colunas_Tabela_Saldo';
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';

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
        <div className="overflow-hidden rounded-xl bg-white shadow-md shadow-black">
            <div className="overflow-x-auto">
                <table
                    className="w-full border-separate border-spacing-0"
                    style={{ minWidth: '800px' }}
                >
                    <thead className="sticky top-0 z-10">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <th
                                        key={header.id}
                                        className="bg-purple-800 p-3 text-base font-extrabold tracking-widest text-white shadow-md shadow-black select-none"
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
                                className={`transition-colors ${
                                    idx % 2 === 0 ? 'bg-white' : 'bg-white'
                                } hover:bg-teal-200`}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <td key={cell.id} className="border-b border-gray-300 p-3">
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
