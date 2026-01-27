const express = require("express");
const router = express.Router();

const warehouseTaskService = require("../core/warehouseTaskService");
const { validateWarehouseTaskJson } = require("../util/validation");
const { normalizeWarehouseTaskInput } = require("../util/mapping");
const { withTransaction } = require("../infra/db");
const binInfoModel = require("../models/binInfoModel");
const { publishNavPlan } = require("../mqtt/navPlanPublisher");

// Default start when source is empty/missing
const DEFAULT_START = { x: 0.5, y: 0.5 };

router.post("/", async (req, res) => {
  const err = validateWarehouseTaskJson(req.body);
  if (err) return res.status(400).json({ error: err });

  try {
    const result = await warehouseTaskService.createFromSapJson(req.body);

    // ALSO publish immediately for the new planner flow:
    // HTTP /task → MQTT marvin/nav/plan with {start, goal}
    // start = source bin coords (if provided & found), else default (0.5,0.5)
    // goal  = destination bin coords (required & must exist in bininfo)
    const normalized = normalizeWarehouseTaskInput(req.body);

    const pub = await withTransaction(async (client) => {
      const srcName = normalized.sourceBin;
      const dstName = normalized.destBin;

      const dest = await binInfoModel.findByName(client, dstName);
      const source = (srcName && String(srcName).trim() !== "")
        ? await binInfoModel.findByName(client, srcName)
        : null;

      if (!dest) {
        return { published: false, reason: "DEST_BININFO_MISSING", destBin: dstName };
      }

      const start = source
        ? { x: Number(source.locationx), y: Number(source.locationy) }
        : DEFAULT_START;
      const goal = { x: Number(dest.locationx), y: Number(dest.locationy) };

      const payload = {
        start,
        goal,
        meta: {
          source: "http:/task",
          marvinTaskId: result.marvinTaskId,
          wtid: result.wtid,
          sourceBin: source ? source.binname : (srcName || null),
          destBin: dest.binname
        },
        ts: new Date().toISOString()
      };

      publishNavPlan(payload);
      return { published: true, payload };
    });

    return res.status(201).json({ ...result, mqtt: pub });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to create task" });
  }
});

module.exports = router;
