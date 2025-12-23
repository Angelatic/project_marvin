async function insertOrUpdate(client, fp) {
  const res = await client.query(
    `INSERT INTO floorplan
     (name, version, sourcetype, jsonpath, pgmpath, yamlpath, createdat, updatedat)
     VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())
     RETURNING *`,
    [fp.name, fp.version, fp.sourceType, fp.jsonPath || null, fp.pgmPath || null, fp.yamlPath || null]
  );
  return res.rows[0];
}

async function setDefault(client, floorplanId) {
  await client.query(`UPDATE floorplan SET isdefault = FALSE`);
  const res = await client.query(
    `UPDATE floorplan SET isdefault = TRUE, updatedat = NOW()
     WHERE floorplanid = $1
     RETURNING *`,
    [floorplanId]
  );
  return res.rows[0] || null;
}

async function getDefault(client) {
  const res = await client.query(`SELECT * FROM floorplan WHERE isdefault = TRUE LIMIT 1`);
  return res.rows[0] || null;
}

async function getById(client, floorplanId) {
  const res = await client.query(`SELECT * FROM floorplan WHERE floorplanid = $1`, [floorplanId]);
  return res.rows[0] || null;
}

module.exports = { insertOrUpdate, setDefault, getDefault, getById };
