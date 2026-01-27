const { withTransaction } = require("../infra/db");
const { config } = require("../infra/config");
const logger = require("../infra/logger");

const marvinTaskModel = require("../models/marvinTaskModel");
const robotModel = require("../models/robotModel");
const robotLogModel = require("../models/robotLogModel");
const marvinTaskService = require("./marvinTaskService");

let timer = null;

function isRobotFresh(latestLog) {
  if (!latestLog) return false;
  const ageMs = Date.now() - new Date(latestLog.logtime).getTime();
  return ageMs <= config.ROBOT_STATUS_STALE_MS;
}

async function pickRobot(client) {
  const robots = await robotModel.listAll(client);
  if (!robots.length) return null;

  //kies de eerste robot die recent status heeft gepublished
  for (const r of robots) {
    const last = await robotLogModel.getLatestByRobot(client, r.robotid);
    if (isRobotFresh(last)) return r;
  }

  //kies eerste robot (demo)
  return robots[0];
}

/*async function assignAndSendOnce() {
  // Zoek taken die klaarstaan
  const queued = await withTransaction(async (client) => {
    return marvinTaskModel.listByStatus(client, "QUEUED");
  });

  for (const t of queued) {
    const didAssign = await withTransaction(async (client) => {
      const robot = await pickRobot(client);
      if (!robot) return null;

      const updated = await marvinTaskModel.assignRobot(client, t.marvintaskid, robot.robotid);
      if (!updated) return null;

      // Log assignment
      const taskLogService = require("./taskLogService");
      await taskLogService.logStatus(client, t.marvintaskid, "ASSIGNED", null, null);

      return { marvinTaskId: t.marvintaskid, robotId: robot.robotid };
    });

    if (didAssign) {
      // Send outside the assignment transaction is ok, sendToRobot has its own transaction
      await marvinTaskService.sendToRobot(didAssign.marvinTaskId);
    }
  }
}*/

async function assignAndSendOnce() {
  const t = await withTransaction(async (client) => {
    return marvinTaskModel.getNextQueued(client);
  });
  if (!t) return;

  const didAssign = await withTransaction(async (client) => {
    const robot = await pickRobot(client);
    if (!robot) return null;

    const updated = await marvinTaskModel.assignRobot(client, t.marvintaskid, robot.robotid);
    if (!updated) return null;

    const taskLogService = require("./taskLogService");
    await taskLogService.logStatus(client, t.marvintaskid, "ASSIGNED", null, null);

    return { marvinTaskId: t.marvintaskid, robotId: robot.robotid };
  });

  if (didAssign) {
    await marvinTaskService.sendToRobot(didAssign.marvinTaskId);
  }
}

function startScheduler() {
  if (timer) return;

  logger.info(`Task assignment scheduler started (${config.ASSIGNMENT_INTERVAL_MS} ms)`);
  timer = setInterval(() => {
    assignAndSendOnce().catch((err) => logger.error("assignAndSendOnce failed", err));
  }, config.ASSIGNMENT_INTERVAL_MS);
}

function stopScheduler() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  logger.info("Task assignment scheduler stopped");
}

module.exports = { startScheduler, stopScheduler, assignAndSendOnce };
