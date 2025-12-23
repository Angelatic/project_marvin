async function insert(client, { robotId, logLevel, message, details }) {
  const res = await client.query(
    `INSERT INTO robotlog (robotid, logtime, loglevel, message, details)
     VALUES ($1,NOW(),$2,$3,$4)
     RETURNING *`,
    [robotId, logLevel || null, message || null, details || null]
  );
  return res.rows[0];
}

async function getLatestByRobot(client, robotId) {
  const res = await client.query(
    `SELECT * FROM robotlog
     WHERE robotid = $1
     ORDER BY logtime DESC
     LIMIT 1`,
    [robotId]
  );
  return res.rows[0] || null;
}

module.exports = { insert, getLatestByRobot };
