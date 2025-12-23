async function findByName(client, binName) {
  const res = await client.query(`SELECT * FROM bininfo WHERE binname = $1`, [binName]);
  return res.rows[0] || null;
}

async function upsert(client, { binName, locationX, locationY }) {
  const res = await client.query(
    `INSERT INTO bininfo (binname, locationx, locationy, createdat, updatedat)
     VALUES ($1,$2,$3,NOW(),NOW())
     ON CONFLICT (binname)
     DO UPDATE SET locationx = EXCLUDED.locationx,
                   locationy = EXCLUDED.locationy,
                   updatedat = NOW()
     RETURNING *`,
    [binName, locationX ?? null, locationY ?? null]
  );
  return res.rows[0];
}

module.exports = { findByName, upsert };
