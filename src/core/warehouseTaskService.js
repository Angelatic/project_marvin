// src/core/warehouseTaskService.js
const { withTransaction } = require("../infra/db");
const warehouseTaskModel = require("../models/warehouseTaskModel");
const marvinTaskService = require("./marvinTaskService");
const { normalizeWarehouseTaskInput } = require("../util/mapping");

async function createFromSapJson(originalPayload) {
  return withTransaction(async (client) => {
    const normalized = normalizeWarehouseTaskInput(originalPayload);

    // WarehouseTask opslaan (kolommen uit normalized, rawtext = originele payload)
    const wt = await warehouseTaskModel.insertFromNormalized(client, normalized, originalPayload);

    // MarvinTask opbouwen + TaskLog (ongewijzigd)
    const mt = await marvinTaskService.createFromWarehouseTask(client, wt);

    // Response richting SAP
    return {
      wtid: wt.wtid,
      marvinTaskId: mt.marvinTaskId,
      status: mt.status,
      missing: mt.missing
    };
  });
}

module.exports = { createFromSapJson };
