const express = require("express");
const { loadConfig, config } = require("./infra/config");
const logger = require("./infra/logger");
const { db } = require("./infra/db");

const taskRoutes = require("./api/taskRoutes");
const binInfoRoutes = require("./api/binInfoRoutes");
const floorplanRoutes = require("./api/floorplanRoutes");
const statusRoutes = require("./api/statusRoutes");
const healthRoutes = require("./api/healthRoutes");
const pointRoutes = require("./api/pointRoutes");

const mqttClient = require("./infra/mqttClient");
const registerMqttHandlers = require("./mqtt/mqttRouter");

const recoveryService = require("./core/recoveryService");
const taskAssignmentService = require("./core/taskAssignmentService");

loadConfig();

const app = express();
app.use(express.json());

// API routes (SAP / UI)
app.use("/task", taskRoutes);
app.use("/bininfo", binInfoRoutes);
app.use("/floorplan", floorplanRoutes);
app.use("/point", pointRoutes);
app.use("/status", statusRoutes);
app.use("/health", healthRoutes);

const PORT = config.HTTP_PORT;

app.listen(PORT, async () => {
  logger.info(`HTTP server running on port ${PORT}`);

  // DB sanity check
  try {
    await db.query("SELECT 1");
    logger.info("Database connection OK");
  } catch (err) {
    logger.error("Database connection failed", err);
    return;
  }

  // MQTT subscribe + handlers
  registerMqttHandlers(mqttClient);

  // Recovery (Flow 8)
  try {
    const res = await recoveryService.runStartupRecovery();
    logger.info("Recovery done", res);
  } catch (err) {
    logger.error("Recovery failed", err);
  }

  // Assignment scheduler (Flow 4 trigger)
  taskAssignmentService.startScheduler();
});
