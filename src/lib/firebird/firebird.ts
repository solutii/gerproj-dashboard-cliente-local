import Firebird from 'node-firebird';

export const firebirdOptions: Firebird.Options = {
  host: process.env.FIREBIRD_HOST,
  port: Number(process.env.FIREBIRD_PORT),
  database: process.env.FIREBIRD_DATABASE,
  user: process.env.FIREBIRD_USER,
  password: process.env.FIREBIRD_PASSWORD,
  lowercase_keys: false,
  pageSize: 4096,
};

export function queryFirebird<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Firebird.attach(firebirdOptions, (err, db) => {
      if (err) return reject(err);

      db.query(sql, params, (err, result) => {
        db.detach();
        if (err) return reject(err);
        resolve(result as T[]);
      });
    });
  });
}


