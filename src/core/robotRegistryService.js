const { withTransaction } = require("../infra/db");
const robotModel = require("../models/robotModel");

async function upsertRobot(robot) {
  return withTransaction(async (client) => robotModel.upsert(client, robot));
}

module.exports = { upsertRobot };
