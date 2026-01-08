const mqttClient = require("../infra/mqttClient");
const { config } = require("../infra/config");
const logger = require("../infra/logger");

function publishFloorplanUpdate(payload) {
  mqttClient.publish(
    config.MQTT_TOPIC_FLOORPLAN_UPDATE,
    JSON.stringify(payload),
    { qos: 0 },
    (err) => {
      if (err) logger.error("Publish floorplan update failed", err);
      else logger.info(`Published floorplan update usePGM=${payload.usePGM}`);
    }
  );
}

module.exports = { publishFloorplanUpdate };
