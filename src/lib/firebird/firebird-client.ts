// src/lib/firebird/firebird-client.ts
import { executeFirebird, executeFirebirdTransaction, queryFirebird } from './firebird';

const globalForFirebird = globalThis as unknown as {
    firebirdQuery?: typeof queryFirebird;
    firebirdExecute?: typeof executeFirebird;
    firebirdExecuteTransaction?: typeof executeFirebirdTransaction;
};

export const firebirdQuery = globalForFirebird.firebirdQuery ?? queryFirebird;
export const firebirdExecute = globalForFirebird.firebirdExecute ?? executeFirebird;
export const firebirdExecuteTransaction =
    globalForFirebird.firebirdExecuteTransaction ?? executeFirebirdTransaction;

if (process.env.NODE_ENV !== 'production') {
    globalForFirebird.firebirdQuery = firebirdQuery;
    globalForFirebird.firebirdExecute = firebirdExecute;
    globalForFirebird.firebirdExecuteTransaction = firebirdExecuteTransaction;
}
