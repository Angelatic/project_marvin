async function insertOrUpdate(client, fp) {
  const floorplanJson = fp.floorplanJson ?? fp.floorplan ?? null;

  // usePGM afleiden:
  // - als sourceType PGM is dan usePGM=true
  // - als sourceType JSON is dan usePGM=false
  // - expliciet meegegeven usePGM
  const sourceType = String(fp.sourceType || "").toUpperCase();
  const usePgm =
    (fp.usePGM !== undefined && fp.usePGM !== null)
      ? !!fp.usePGM
      : (sourceType === "JSON" ? false : true);

  const res = await client.query(
    `INSERT INTO floorplan
     (name, version, sourcetype, floorplanjson, usepgm, pgmpath, yamlpath, createdat, updatedat)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
     RETURNING *`,
    [
      fp.name,
      fp.version,
      fp.sourceType,
      floorplanJson,
      usePgm,
      fp.pgmPath || null,
      fp.yamlPath || null
    ]
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
