const mysql = require("mysql2/promise");

const dbConfig = {
//   host: "localhost",
//   user: "root",
//   password:  "",
//   database:  "visa",
host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  port:  3306,
};

const pool = mysql.createPool(dbConfig);

module.exports = pool;
