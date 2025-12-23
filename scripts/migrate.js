const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const dir = path.join(__dirname, "..", "migrations");
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();

  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    console.log(`Applying ${f}`);
    await pool.query(sql);
  }

  await pool.end();
  console.log("Done");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
