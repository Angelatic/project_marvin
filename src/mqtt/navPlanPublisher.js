const mqttClient = require("../infra/mqttClient");
const { config } = require("../infra/config");
const logger = require("../infra/logger");

function publishNavPlan(payload) {
  const topic = config.MQTT_TOPIC_NAV_PLAN || "marvin/nav/plan";
  mqttClient.publish(topic, JSON.stringify(payload), { qos: 0 }, (err) => {
    if (err) logger.error("Publish nav plan failed", err);
    else logger.info(`Published nav plan start=(${payload?.start?.x},${payload?.start?.y}) goal=(${payload?.goal?.x},${payload?.goal?.y})`);
  });
}

module.exports = { publishNavPlan };
