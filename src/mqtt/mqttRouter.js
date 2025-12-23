const { config } = require("../infra/config");
const logger = require("../infra/logger");

const robotStatusHandler = require("./robotStatusHandler");
const taskStatusHandler = require("./taskStatusHandler");

function registerMqttHandlers(client) {
  client.on("connect", () => {
    logger.info("MQTT subscribing...");
    client.subscribe([config.MQTT_TOPIC_ROBOT_STATUS, config.MQTT_TOPIC_TASK_STATUS], (err) => {
      if (err) logger.error("MQTT subscribe failed", err);
    });
  });

  client.on("message", (topic, payload) => {
    let json;
    try {
      json = JSON.parse(payload.toString());
    } catch (e) {
      logger.error(`Invalid JSON on ${topic}`);
      return;
    }

    if (topic === config.MQTT_TOPIC_ROBOT_STATUS) {
      robotStatusHandler.handle(json).catch((err) => logger.error("robotStatusHandler failed", err));
      return;
    }

    if (topic === config.MQTT_TOPIC_TASK_STATUS) {
      taskStatusHandler.handle(json).catch((err) => logger.error("taskStatusHandler failed", err));
      return;
    }

    logger.warn(`Unhandled topic ${topic}`);
  });
}

module.exports = registerMqttHandlers;
