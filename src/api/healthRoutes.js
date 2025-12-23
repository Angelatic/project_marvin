const express = require("express");
const router = express.Router();

const { db } = require("../infra/db");
const mqttClient = require("../infra/mqttClient");

router.get("/", (req, res) => res.json({ status: "ok" }));

router.get("/ready", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ ready: true, mqtt: !!mqttClient.connected });
  } catch (e) {
    res.status(500).json({ ready: false });
  }
});

module.exports = router;
