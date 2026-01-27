async function insert(client, { wtid, sourceBinInfoId, destBinInfoId, status, robotId }) {
  const res = await client.query(
    `INSERT INTO marvintask
     (wtid, sourcebininfoid, destbininfoid, status, robotid, createdat, updatedat)
     VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
     RETURNING *`,
    [wtid, sourceBinInfoId, destBinInfoId, status, robotId]
  );
  return res.rows[0];
}

async function updateStatus(client, marvinTaskId, status) {
  const res = await client.query(
    `UPDATE marvintask SET status = $2, updatedat = NOW()
     WHERE marvintaskid = $1
     RETURNING *`,
    [marvinTaskId, status]
  );
  return res.rows[0] || null;
}

async function assignRobot(client, marvinTaskId, robotId) {
  const res = await client.query(
    `UPDATE marvintask SET robotid = $2, updatedat = NOW()
     WHERE marvintaskid = $1
     RETURNING *`,
    [marvinTaskId, robotId]
  );
  return res.rows[0] || null;
}

async function getById(client, marvinTaskId) {
  const res = await client.query(`SELECT * FROM marvintask WHERE marvintaskid = $1`, [marvinTaskId]);
  return res.rows[0] || null;
}

async function listByStatus(client, status) {
  const res = await client.query(`SELECT * FROM marvintask WHERE status = $1 ORDER BY createdat ASC`, [status]);
  return res.rows;
}

async function listInTransientStates(client) {
  const res = await client.query(
    `SELECT * FROM marvintask WHERE status IN ('SENT','RUNNING') ORDER BY updatedat ASC`
  );
  return res.rows;
}

async function getTaskWithLatestLog(client, marvinTaskId) {
  const res = await client.query(
    `SELECT mt.*,
            tl.status AS last_status,
            tl.datetime AS last_status_time
     FROM marvintask mt
     LEFT JOIN LATERAL (
       SELECT * FROM tasklog
       WHERE marvintaskid = mt.marvintaskid
       ORDER BY datetime DESC
       LIMIT 1
     ) tl ON TRUE
     WHERE mt.marvintaskid = $1`,
    [marvinTaskId]
  );
  return res.rows[0] || null;
}

async function claimNextQueued(client, robotId) {
  const { rows } = await client.query(
    `
    WITH next_task AS (
      SELECT marvintaskid
      FROM marvintask
      WHERE status = 'QUEUED'
      ORDER BY created_at ASC, marvintaskid ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE marvintask mt
    SET robotid = $1,
        status = 'ASSIGNED'
    FROM next_task
    WHERE mt.marvintaskid = next_task.marvintaskid
    RETURNING mt.*;
    `,
    [robotId]
  );

  return rows[0] || null;
}


module.exports = {
  insert,
  updateStatus,
  assignRobot,
  getById,
  listByStatus,
  listInTransientStates,
  getTaskWithLatestLog,
  claimNextQueued
};
