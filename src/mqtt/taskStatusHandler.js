const { validateTaskStatusJson } = require("../util/validation");
const robotLogService = require("../core/robotLogService");
const marvinTaskService = require("../core/marvinTaskService");

async function handle(message) {
  const err = validateTaskStatusJson(message);
  if (err) return;

  const marvinTaskId = Number(message.marvinTaskId);
  if (!Number.isFinite(marvinTaskId)) return;

  const status = String(message.status).toUpperCase();

  let robotLogId = null;
  if (message.robotId !== undefined && message.robotId !== null) {
    const robotId = Number(message.robotId);
    const level = (status === "FAILED" || status === "ABORTED") ? "ERROR" : "INFO";
    const log = await robotLogService.logRobotEvent({
      robotId,
      logLevel: level,
      message: `TASK_${status}`,
      details: message.details ? JSON.stringify(message.details) : null
    });
    robotLogId = log.robotlogid;
  }

  await marvinTaskService.updateStatusFromRobot(marvinTaskId, status, robotLogId);
}

module.exports = { handle };
