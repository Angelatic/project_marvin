require("dotenv").config();

const config = {
  HTTP_PORT: Number(process.env.HTTP_PORT),

  DATABASE_URL: process.env.DATABASE_URL,

  MQTT_URL: process.env.MQTT_URL,
  MQTT_TOPIC_ROBOT_STATUS: process.env.MQTT_TOPIC_ROBOT_STATUS,
  MQTT_TOPIC_TASK_STATUS: process.env.MQTT_TOPIC_TASK_STATUS,
  MQTT_TOPIC_NEW_TASK: process.env.MQTT_TOPIC_NEW_TASK,

  ASSIGNMENT_INTERVAL_MS: Number(process.env.ASSIGNMENT_INTERVAL_MS),
  ROBOT_STATUS_STALE_MS: Number(process.env.ROBOT_STATUS_STALE_MS)
};

function loadConfig() {
  if (!config.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  return config;
}

module.exports = { config, loadConfig };
