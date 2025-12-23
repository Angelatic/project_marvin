// src/util/mapping.js

function toNumberOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Normaliseert input voor WarehouseTask zodat de rest van het systeem altijd
 * hetzelfde formaat krijgt, ongeacht of SAP een geneste event-payload stuurt
 * of jij een platte payload test.
 *
 * Output is bewust "camelCase intern", DB mapping gebeurt in het model.
 *
 * @param {object} payload originele request body
 * @returns {{
 *   ewmWarehouse: string,
 *   warehouseOrder: string,
 *   warehouseTask: (string|null),
 *   warehouseTaskItem: (string|null),
 *   sourceBin: string,
 *   destBin: string
 * }}
 */
function normalizeWarehouseTaskInput(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Body is required");
  }

  // --- Nieuwe geneste SAP payload ---
  const nestedData =
    payload?.MarvinTask?.EWMEventData?.eventData?.data;

  const nestedWT =
    payload?.MarvinTask?.S4Data?.WarehouseTask?.WarehouseTaskType;

  const hasNested =
    nestedData && typeof nestedData === "object" &&
    nestedWT && typeof nestedWT === "object";

  if (hasNested) {
    const ewmWarehouse = nestedData.EWMWarehouse;
    const warehouseOrder = nestedData.WarehouseOrder;
    const warehouseTask = nestedData.WarehouseTask ?? null;
    const warehouseTaskItem = nestedData.WarehouseTaskItem ?? null;

    const sourceBin = nestedWT.SourceStorageBin;
    const destBin = nestedWT.DestinationStorageBin;

    return {
      ewmWarehouse,
      warehouseOrder,
      warehouseTask,
      warehouseTaskItem,
      sourceBin,
      destBin
    };
  }

  // --- Oude platte payload (backwards compatible) ---
  // (handig voor simpele Postman tests of oudere SAP mapping)
  const ewmWarehouse = payload.EWMWarehouse;
  const warehouseOrder = payload.WarehouseOrder;
  const warehouseTask = payload.WarehouseTask ?? null;
  const warehouseTaskItem = payload.WarehousetaskItem ?? payload.WarehouseTaskItem ?? payload.WarehousTaskItem ?? null;

  const sourceBin = payload.sourceBin;
  const destBin = payload.destBin;

  return {
    ewmWarehouse,
    warehouseOrder,
    warehouseTask,
    warehouseTaskItem,
    sourceBin,
    destBin
  };
}

module.exports = {
  toNumberOrNull,
  isNonEmptyString,
  normalizeWarehouseTaskInput
};
