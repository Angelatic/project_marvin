const { validateRobotStatusJson } = require("../util/validation");
const robotRegistryService = require("../core/robotRegistryService");
const robotLogService = require("../core/robotLogService");

async function handle(message) {
  const err = validateRobotStatusJson(message);
  if (err) return;

  const robotId = Number(message.robotId);
  if (!Number.isFinite(robotId)) return;

  await robotRegistryService.upsertRobot({
    robotId,
    name: message.name || null,
    startLocationX: message.startLocationX ?? null,
    startLocationY: message.startLocationY ?? null,
    function: message.function || null
  });

  await robotLogService.logRobotEvent({
    robotId,
    logLevel: message.logLevel || "INFO",
    message: message.status || "ROBOT_STATUS",
    details: message.details ? JSON.stringify(message.details) : null
  });
}

module.exports = { handle };
