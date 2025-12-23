const express = require("express");
const router = express.Router();

const warehouseTaskService = require("../core/warehouseTaskService");
const { validateWarehouseTaskJson } = require("../util/validation");

router.post("/", async (req, res) => {
  const err = validateWarehouseTaskJson(req.body);
  if (err) return res.status(400).json({ error: err });

  try {
    const result = await warehouseTaskService.createFromSapJson(req.body);
    return res.status(201).json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to create task" });
  }
});

module.exports = router;
