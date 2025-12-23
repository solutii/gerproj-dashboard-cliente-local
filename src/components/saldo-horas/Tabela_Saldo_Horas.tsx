'use client';

import {
  getColunasSaldo,
  SaldoRowProps,
} from '@/components/saldo-horas/Colunas_Tabela_Saldo';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

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
    <div className="overflow-hidden rounded-xl border border-purple-200 shadow-xl bg-white">
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
                    className="bg-purple-700 p-3 sm:p-4 font-extrabold tracking-widest text-white border-b-2 border-purple-900"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
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
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                } hover:bg-purple-50`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="p-3 sm:p-4 border-b border-gray-200"
                  >
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext(),
                    )}
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