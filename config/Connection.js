const mysql = require("mysql2/promise");

const dbConfig = {
  //   host: "localhost",
  //   user: "root",
  //   password:  "",
  //   database:  "visa",
  host: process.env.DB_HOST || "37.27.187.4",
  user: "root",
  password: process.env.DB_PASSWORD || "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: process.env.DB_NAME || "visa",
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  maxIdle: Number(process.env.DB_MAX_IDLE || 10),
  idleTimeout: Number(process.env.DB_IDLE_TIMEOUT_MS || 60000),
  queueLimit: 0,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
  enableKeepAlive: true,
  keepAliveInitialDelay: Number(process.env.DB_KEEP_ALIVE_INITIAL_DELAY_MS || 0),
};

const pool = mysql.createPool(dbConfig);
const originalGetConnection = pool.getConnection.bind(pool);

const retryableConnectionCodes = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
  "PROTOCOL_ENQUEUE_AFTER_QUIT",
]);

const isRetryableConnectionError = (error) => {
  if (!error) {
    return false;
  }

  return retryableConnectionCodes.has(error.code);
};

pool.getConnection = async function getHealthyConnection() {
  let connection;

  try {
    connection = await originalGetConnection();
    await connection.ping();
    return connection;
  } catch (error) {
    if (connection) {
      connection.destroy();
    }

    if (!isRetryableConnectionError(error)) {
      throw error;
    }

    console.warn(
      `[DB] Retrying MySQL connection after transient error: ${error.code || error.message}`
    );

    const freshConnection = await originalGetConnection();

    try {
      await freshConnection.ping();
      return freshConnection;
    } catch (retryError) {
      freshConnection.destroy();
      throw retryError;
    }
  }
};

module.exports = pool;
