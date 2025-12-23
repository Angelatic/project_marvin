const { withTransaction } = require("../infra/db");
const robotLogModel = require("../models/robotLogModel");

async function logRobotEvent({ robotId, logLevel, message, details }) {
  return withTransaction(async (client) =>
    robotLogModel.insert(client, { robotId, logLevel, message, details })
  );
}

module.exports = { logRobotEvent };
