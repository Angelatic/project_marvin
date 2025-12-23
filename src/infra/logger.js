function log(level, msg, meta) {
  const base = `[${new Date().toISOString()}] [${level}] ${msg}`;
  if (meta !== undefined) console.log(base, meta);
  else console.log(base);
}

module.exports = {
  info: (m, meta) => log("INFO", m, meta),
  warn: (m, meta) => log("WARN", m, meta),
  error: (m, meta) => log("ERROR", m, meta),
  debug: (m, meta) => log("DEBUG", m, meta)
};
