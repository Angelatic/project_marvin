// src/util/validation.js
const { isNonEmptyString, normalizeWarehouseTaskInput } = require("./mapping");

function validateWarehouseTaskJson(payload) {
  try {
    const n = normalizeWarehouseTaskInput(payload);

    if (!isNonEmptyString(n.ewmWarehouse)) return "EWMWarehouse is required";
    if (!isNonEmptyString(n.warehouseOrder)) return "WarehouseOrder is required";
    if (!isNonEmptyString(n.sourceBin)) return "sourceBin/SourceStorageBin is required";
    if (!isNonEmptyString(n.destBin)) return "destBin/DestinationStorageBin is required";

    // WarehouseTask en WarehouseTaskItem zijn bij jou functioneel handig,
    // maar niet altijd strikt noodzakelijk.
    if (n.warehouseTask !== null && !isNonEmptyString(n.warehouseTask)) {
      return "WarehouseTask must be a non-empty string if provided";
    }
    if (n.warehouseTaskItem !== null && !isNonEmptyString(n.warehouseTaskItem)) {
      return "WarehouseTaskItem must be a non-empty string if provided";
    }

    return null;
  } catch (e) {
    return e.message || "Invalid body";
  }
}

function validateBinInfoJson(json) {
  const arr = Array.isArray(json) ? json : [json];
  if (!arr.length) return "At least one binInfo entry is required";

  for (const b of arr) {
    if (!b || typeof b !== "object") return "Each binInfo entry must be an object";
    if (!isNonEmptyString(b.binName)) return "binName is required";
  }
  return null;
}

function validateFloorplanJson(json) {
  if (!json || typeof json !== "object") return "Body is required";
  if (!isNonEmptyString(json.name)) return "name is required";
  if (!isNonEmptyString(json.version)) return "version is required";
  if (!isNonEmptyString(json.sourceType)) return "sourceType is required";

  const sourceType = String(json.sourceType).toUpperCase();

  if (sourceType === "JSON") {
    const fp = json.floorplanJson ?? json.floorplan;
    if (!fp || typeof fp !== "object") return "floorplanJson (object) is required for sourceType=JSON";
  }

  // Voor PGM is floorplanJson niet nodig, want robot gebruikt lokale PGM/YAML
  return null;
}

function validateRobotStatusJson(json) {
  if (!json || typeof json !== "object") return "Body is required";
  if (json.robotId === undefined || json.robotId === null) return "robotId is required";
  return null;
}

function validateTaskStatusJson(json) {
  if (!json || typeof json !== "object") return "Body is required";
  if (json.marvinTaskId === undefined || json.marvinTaskId === null) return "marvinTaskId is required";
  if (!isNonEmptyString(json.status)) return "status is required";
  return null;
}

module.exports = {
  validateWarehouseTaskJson,
  validateBinInfoJson,
  validateFloorplanJson,
  validateRobotStatusJson,
  validateTaskStatusJson
};
