const mqtt = require("mqtt");
const { config } = require("./config");
const logger = require("./logger");

const client = mqtt.connect(config.MQTT_URL, {
  reconnectPeriod: 1000,
  connectTimeout: 5000,
  clean: true
});

client.on("connect", () => logger.info("MQTT connected"));
client.on("reconnect", () => logger.warn("MQTT reconnecting"));
client.on("close", () => logger.warn("MQTT connection closed"));
client.on("error", (err) => logger.error("MQTT error", err));

module.exports = client;
