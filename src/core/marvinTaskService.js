const marvinTaskModel = require("../models/marvinTaskModel");
const binInfoModel = require("../models/binInfoModel");
const taskLogService = require("./taskLogService");
const floorplanModel = require("../models/floorplanModel");

const { withTransaction } = require("../infra/db");
const { publishNewTask } = require("../mqtt/newTaskPublisher");

function initialStatus(sourceBinInfo, destBinInfo) {
  return (sourceBinInfo && destBinInfo) ? "QUEUED" : "BININFO_MISSING";
}

// Flow 3
async function createFromWarehouseTask(client, wtRow) {
  const source = await binInfoModel.findByName(client, wtRow.sourcebin);
  const dest = await binInfoModel.findByName(client, wtRow.destbin);

  const status = initialStatus(source, dest);

  const mt = await marvinTaskModel.insert(client, {
    wtid: wtRow.wtid,
    sourceBinInfoId: source ? source.bininfoid : null,
    destBinInfoId: dest ? dest.bininfoid : null,
    status,
    robotId: null
  });

  await taskLogService.logStatus(client, mt.marvintaskid, status, null, null);

  return {
    marvinTaskId: mt.marvintaskid,
    status,
    missing: {
      sourceBin: source ? null : wtRow.sourcebin,
      destBin: dest ? null : wtRow.destbin
    }
  };
}

// Flow 6
async function updateStatusFromRobot(marvinTaskId, status, robotLogId) {
  return withTransaction(async (client) => {
    const updated = await marvinTaskModel.updateStatus(client, marvinTaskId, status);
    if (!updated) return null;
    await taskLogService.logStatus(client, marvinTaskId, status, robotLogId ?? null, null);
    return updated;
  });
}

// Flow 4 (send)
async function sendToRobot(marvinTaskId) {
  return withTransaction(async (client) => {
    const task = await marvinTaskModel.getById(client, marvinTaskId);
    if (!task) return null;

    // Guard rails
    if (!task.robotid) {
      await taskLogService.logStatus(client, marvinTaskId, "NO_ROBOT_ASSIGNED", null, null);
      return null;
    }
    if (!task.sourcebininfoid || !task.destbininfoid) {
      await marvinTaskModel.updateStatus(client, marvinTaskId, "BININFO_MISSING");
      await taskLogService.logStatus(client, marvinTaskId, "BININFO_MISSING", null, null);
      return null;
    }

    const source = await client.query(`SELECT * FROM bininfo WHERE bininfoid = $1`, [task.sourcebininfoid]).then(r => r.rows[0] || null);
    const dest = await client.query(`SELECT * FROM bininfo WHERE bininfoid = $1`, [task.destbininfoid]).then(r => r.rows[0] || null);

    const fp = await floorplanModel.getDefault(client);
    if (!fp) {
      await marvinTaskModel.updateStatus(client, marvinTaskId, "NO_FLOORPLAN");
      await taskLogService.logStatus(client, marvinTaskId, "NO_FLOORPLAN", null, null);
      return null;
    }

    const payload = {
      marvinTaskId,
      robotId: task.robotid,
      floorplanId: fp.floorplanid,
      source: { binName: source.binname, x: Number(source.locationx), y: Number(source.locationy) },
      destination: { binName: dest.binname, x: Number(dest.locationx), y: Number(dest.locationy) }
    };

    publishNewTask(payload);

    await marvinTaskModel.updateStatus(client, marvinTaskId, "SENT");
    await taskLogService.logStatus(client, marvinTaskId, "SENT", null, fp.floorplanid);

    return payload;
  });
}

module.exports = { createFromWarehouseTask, updateStatusFromRobot, sendToRobot };
