async function insert(client, { marvinTaskId, status, robotLogId, floorplanId }) {
  const res = await client.query(
    `INSERT INTO tasklog (marvintaskid, status, datetime, robotlogid, floorplanid)
     VALUES ($1,$2,NOW(),$3,$4)
     RETURNING *`,
    [marvinTaskId, status, robotLogId ?? null, floorplanId ?? null]
  );
  return res.rows[0];
}

async function listByTask(client, marvinTaskId, limit = 50) {
  const res = await client.query(
    `SELECT * FROM tasklog
     WHERE marvintaskid = $1
     ORDER BY datetime DESC
     LIMIT $2`,
    [marvinTaskId, limit]
  );
  return res.rows;
}

module.exports = { insert, listByTask };
