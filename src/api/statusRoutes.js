const express = require("express");
const router = express.Router();

const statusService = require("../core/statusService");

// GET /status/task/:id
router.get("/task/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  try {
    const data = await statusService.getTaskStatus(id);
    if (!data) return res.status(404).json({ error: "Task not found" });
    return res.json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch task status" });
  }
});

// GET /status/tasks?status=QUEUED
router.get("/tasks", async (req, res) => {
  const { status } = req.query;
  try {
    const data = await statusService.listTasks(status);
    return res.json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

module.exports = router;
