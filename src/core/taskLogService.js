const taskLogModel = require("../models/taskLogModel");

async function logStatus(client, marvinTaskId, status, robotLogId, floorplanId) {
  return taskLogModel.insert(client, {
    marvinTaskId,
    status,
    robotLogId: robotLogId ?? null,
    floorplanId: floorplanId ?? null
  });
}

module.exports = { logStatus };
