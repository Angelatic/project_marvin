// src/models/warehouseTaskModel.js
// Tabel: warehousetask (lowercase schema)

/**
 * Insert op basis van genormaliseerde waarden,
 * maar bewaart de originele payload in rawtext.
 *
 * @param {*} client pg client
 * @param {{
 *   ewmWarehouse: string,
 *   warehouseOrder: string,
 *   warehouseTask: (string|null),
 *   warehouseTaskItem: (string|null),
 *   sourceBin: string,
 *   destBin: string
 * }} normalized
 * @param {object} originalPayload originele request body (genest of plat)
 */
async function insertFromNormalized(client, normalized, originalPayload) {
  const rawText = JSON.stringify(originalPayload);

  const res = await client.query(
    `INSERT INTO warehousetask
     (ewmwarehouse, warehouseorder, warehousetask, warehousetaskitem,
      sourcebin, destbin, createdat, rawtext)
     VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7)
     RETURNING *`,
    [
      normalized.ewmWarehouse,
      normalized.warehouseOrder,
      normalized.warehouseTask,
      normalized.warehouseTaskItem,
      normalized.sourceBin,
      normalized.destBin,
      rawText
    ]
  );

  return res.rows[0];
}

module.exports = { insertFromNormalized };
