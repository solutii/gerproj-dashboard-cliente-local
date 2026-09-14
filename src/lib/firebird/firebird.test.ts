import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeFirebirdTransaction } from './firebird';

const { mockPoolGet, mockDbTransaction, mockDbDetach } = vi.hoisted(() => ({
    mockPoolGet: vi.fn(),
    mockDbTransaction: vi.fn(),
    mockDbDetach: vi.fn(),
}));

vi.mock('node-firebird', () => ({
    default: {
        ISOLATION_READ_COMMITTED: 'ISOLATION_READ_COMMITTED',
        pool: vi.fn(() => ({ get: mockPoolGet })),
    },
}));

vi.mock('node-firebird/lib/wire/serialize', () => ({
    XdrReader: class {
        readText() {
            return '';
        }
    },
    XdrWriter: class {
        addText() {
            return this;
        }
    },
}));

function criarTransactionMock() {
    return {
        query: vi.fn(),
        commit: vi.fn((cb: (err: Error | null) => void) => cb(null)),
        rollback: vi.fn((cb?: () => void) => cb?.()),
    };
}

function conectarComo(transaction: ReturnType<typeof criarTransactionMock>) {
    mockDbTransaction.mockImplementation(
        (_iso: unknown, cb: (err: Error | null, tx: unknown) => void) => cb(null, transaction)
    );
    mockPoolGet.mockImplementation((cb: (err: Error | null, db: unknown) => void) =>
        cb(null, { transaction: mockDbTransaction, detach: mockDbDetach })
    );
}

describe('executeFirebirdTransaction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('roda todos os statements na mesma transação e comita uma vez', async () => {
        const transaction = criarTransactionMock();
        transaction.query.mockImplementation(
            (_sql: string, _params: unknown[], cb: (err: Error | null) => void) => cb(null)
        );
        conectarComo(transaction);

        await executeFirebirdTransaction([
            {
                sql: `UPDATE CHAMADO SET STATUS_CHAMADO = 'FINALIZADO' WHERE COD_CHAMADO = ?`,
                params: [123],
            },
            {
                sql: `INSERT INTO HISTCHAMADO (COD_HISTCHAMADO, COD_CHAMADO, DESC_HISTCHAMADO) VALUES (?, ?, ?)`,
                params: [1, 123, 'FINALIZADO'],
            },
        ]);

        expect(transaction.query).toHaveBeenCalledTimes(2);
        expect(transaction.commit).toHaveBeenCalledTimes(1);
        expect(transaction.rollback).not.toHaveBeenCalled();
        expect(mockDbDetach).toHaveBeenCalledTimes(1);
    });

    it('faz rollback de tudo quando um statement no meio falha', async () => {
        const transaction = criarTransactionMock();
        const erro = new Error('coluna inválida');
        let chamada = 0;
        transaction.query.mockImplementation(
            (_sql: string, _params: unknown[], cb: (err: Error | null) => void) => {
                chamada += 1;
                cb(chamada === 1 ? null : erro);
            }
        );
        conectarComo(transaction);

        await expect(
            executeFirebirdTransaction([
                {
                    sql: `UPDATE CHAMADO SET STATUS_CHAMADO = 'FINALIZADO' WHERE COD_CHAMADO = ?`,
                    params: [123],
                },
                {
                    sql: `INSERT INTO HISTCHAMADO (COD_HISTCHAMADO, COD_CHAMADO, DESC_HISTCHAMADO) VALUES (?, ?, ?)`,
                    params: [1, 123, 'FINALIZADO'],
                },
            ])
        ).rejects.toThrow('coluna inválida');

        expect(transaction.commit).not.toHaveBeenCalled();
        expect(transaction.rollback).toHaveBeenCalledTimes(1);
    });
});
