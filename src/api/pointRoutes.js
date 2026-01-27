const express = require("express");
const router = express.Router();

const { publishNewTask } = require("../mqtt/newTaskPublisher");

// POST /point
// Body:
// {
//   "x": 2.3,
//   "y": -1.1,
//   "binName": "optional"
// }
// Publishes to MQTT_TOPIC_NEW_TASK (default: marvin/task/new) so the robot can still use /goal_position flow.
router.post("/", async (req, res) => {
  try {
    const x = Number(req.body?.x);
    const y = Number(req.body?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return res.status(400).json({ error: "x and y are required (numbers)" });
    }

    const marvinTaskId = `point-${Date.now()}`;
    const payload = {
      marvinTaskId,
      robotId: req.body?.robotId ?? null,
      floorplanId: req.body?.floorplanId ?? null,
      source: null,
      destination: {
        binName: req.body?.binName ?? null,
        x,
        y
      }
    };

    publishNewTask(payload);
    return res.status(202).json({ status: "published", topic: "new_task", marvinTaskId });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to publish point" });
  }
});

module.exports = router;
