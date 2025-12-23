const express = require("express");
const router = express.Router();

const floorplanService = require("../core/floorplanService");
const { validateFloorplanJson } = require("../util/validation");

// POST /floorplan
router.post("/", async (req, res) => {
  const err = validateFloorplanJson(req.body);
  if (err) return res.status(400).json({ error: err });

  try {
    const fp = await floorplanService.createOrUpdate(req.body);
    return res.status(201).json(fp);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to store floorplan" });
  }
});

// POST /floorplan/use-default { floorplanId }
router.post("/use-default", async (req, res) => {
  const { floorplanId } = req.body || {};
  if (!floorplanId) return res.status(400).json({ error: "floorplanId is required" });

  try {
    const fp = await floorplanService.setDefault(Number(floorplanId));
    if (!fp) return res.status(404).json({ error: "Floorplan not found" });
    return res.status(200).json(fp);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to set default floorplan" });
  }
});

module.exports = router;
