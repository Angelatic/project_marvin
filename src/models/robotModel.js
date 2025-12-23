async function upsert(client, robot) {
  const res = await client.query(
    `INSERT INTO robot (robotid, name, startlocationx, startlocationy, function)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (robotid)
     DO UPDATE SET name = COALESCE(EXCLUDED.name, robot.name),
                   startlocationx = COALESCE(EXCLUDED.startlocationx, robot.startlocationx),
                   startlocationy = COALESCE(EXCLUDED.startlocationy, robot.startlocationy)
     RETURNING *`,
    [robot.robotId, robot.name || null, robot.startLocationX ?? null, robot.startLocationY ?? null, robot.function || null]
  );
  return res.rows[0];
}

async function listAll(client) {
  const res = await client.query(`SELECT * FROM robot ORDER BY robotid ASC`);
  return res.rows;
}

module.exports = { upsert, listAll };
