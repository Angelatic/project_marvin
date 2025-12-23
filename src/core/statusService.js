const { withTransaction } = require("../infra/db");
const marvinTaskModel = require("../models/marvinTaskModel");
const taskLogModel = require("../models/taskLogModel");

async function getTaskStatus(marvinTaskId) {
  return withTransaction(async (client) => {
    const task = await marvinTaskModel.getTaskWithLatestLog(client, marvinTaskId);
    if (!task) return null;

    const logs = await taskLogModel.listByTask(client, marvinTaskId, 50);

    return {
      task,
      logs
    };
  });
}

async function listTasks(status) {
  return withTransaction(async (client) => {
    if (status) return marvinTaskModel.listByStatus(client, status);
    const res = await client.query(`SELECT * FROM marvintask ORDER BY createdat DESC LIMIT 200`);
    return res.rows;
  });
}

module.exports = { getTaskStatus, listTasks };
