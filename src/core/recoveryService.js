const { withTransaction } = require("../infra/db");
const logger = require("../infra/logger");

const marvinTaskModel = require("../models/marvinTaskModel");
const taskLogService = require("./taskLogService");

async function runStartupRecovery() {
  return withTransaction(async (client) => {
    logger.info("Running startup recovery...");

    const transient = await marvinTaskModel.listInTransientStates(client);

    // Demo-veilig: alles wat SENT/RUNNING was wordt weer QUEUED
    for (const t of transient) {
      await marvinTaskModel.updateStatus(client, t.marvintaskid, "QUEUED");
      await taskLogService.logStatus(client, t.marvintaskid, "RECOVERED", null, null);
    }

    return { recovered: transient.length };
  });
}

module.exports = { runStartupRecovery };
