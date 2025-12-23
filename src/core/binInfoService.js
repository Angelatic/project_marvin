const { withTransaction } = require("../infra/db");
const binInfoModel = require("../models/binInfoModel");
const { toNumberOrNull } = require("../util/mapping");

async function upsertFromSapJson(json) {
  const items = Array.isArray(json) ? json : [json];

  return withTransaction(async (client) => {
    const results = [];
    for (const it of items) {
      const row = await binInfoModel.upsert(client, {
        binName: it.binName,
        locationX: toNumberOrNull(it.locationX),
        locationY: toNumberOrNull(it.locationY)
      });
      results.push(row);
    }
    return { count: results.length, rows: results };
  });
}

module.exports = { upsertFromSapJson };
