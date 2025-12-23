const mqttClient = require("../infra/mqttClient");
const { config } = require("../infra/config");
const logger = require("../infra/logger");

function publishNewTask(payload) {
  mqttClient.publish(config.MQTT_TOPIC_NEW_TASK, JSON.stringify(payload), { qos: 0 }, (err) => {
    if (err) logger.error("Publish newtask failed", err);
    else logger.info(`Published newtask for marvinTaskId=${payload.marvinTaskId}`);
  });
}

module.exports = { publishNewTask };
