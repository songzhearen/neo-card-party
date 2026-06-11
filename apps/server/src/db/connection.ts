import mysql, { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from "mysql2/promise";

const DB_NAME = process.env.DB_NAME || "card_party";
const DB_AUTO_CREATE = process.env.DB_AUTO_CREATE !== "false";
const DB_HOST = process.env.DB_HOST || "localhost";
const DB_PORT = parseInt(process.env.DB_PORT || "3306", 10);
const DB_USER = process.env.DB_USER || "root";
const DB_PASSWORD = process.env.DB_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "change-me");

if (process.env.NODE_ENV === "production" && (!process.env.DB_USER || !process.env.DB_PASSWORD)) {
  throw new Error("DB_USER and DB_PASSWORD must be set in production");
}

let pool: Pool;

function createPool(database?: string): Pool {
  return mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
  });
}

pool = createPool(DB_NAME);

export async function initConnection(): Promise<void> {
  if (!DB_AUTO_CREATE) {
    const conn = await pool.getConnection();
    try {
      console.log(`[DB] Using existing database '${DB_NAME}'`);
    } finally {
      conn.release();
    }
    return;
  }

  const initPool = createPool();
  const conn = await initPool.getConnection();
  try {
    await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`[DB] Database '${DB_NAME}' ready`);
  } finally {
    conn.release();
    await initPool.end();
  }
  pool = createPool(DB_NAME);
}

export type QueryResult<T = RowDataPacket> = T[];
export type InsertResult = ResultSetHeader;

export { DB_AUTO_CREATE, DB_NAME, pool, RowDataPacket, ResultSetHeader, PoolConnection };
