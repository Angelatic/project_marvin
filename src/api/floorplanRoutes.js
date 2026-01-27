const express = require("express");
const router = express.Router();

// NOTE: Linux is case-sensitive; file is named FloorplanPublisher.js
const { publishFloorplanUpdate } = require("../mqtt/FloorplanPublisher");

const floorplanService = require("../core/floorplanService");
const { validateFloorplanJson } = require("../util/validation");

// POST /floorplan
router.post("/", async (req, res) => {
  const err = validateFloorplanJson(req.body);
  if (err) return res.status(400).json({ error: err });

  try {
    const fp = await floorplanService.createOrUpdate(req.body);

    // Also publish immediately so the robot/planner can update without an extra call.
    // Map DB/HTTP shape → bridge shape: { usePGM: bool, floorplan: object|null }
    const sourceType = String(fp.sourcetype || req.body.sourceType || "").toUpperCase();
    const usePGM = (fp.usepgm !== undefined && fp.usepgm !== null)
      ? !!fp.usepgm
      : (sourceType === "JSON" ? false : true);

    const floorplanObj = fp.floorplanjson || req.body.floorplanJson || req.body.floorplan || null;
    const payload = usePGM
      ? { usePGM: true, floorplan: null }
      : { usePGM: false, floorplan: floorplanObj };

    publishFloorplanUpdate(payload);

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

    // Publish update map naar robot
    const sourceType = String(fp.sourcetype || "").toUpperCase();
    const usePGM = (fp.usepgm !== undefined && fp.usepgm !== null)
      ? !!fp.usepgm
      : (sourceType === "JSON" ? false : true);

    const payload = usePGM
      ? { usePGM: true, floorplan: null }
      : { usePGM: false, floorplan: fp.floorplanjson || null };

    publishFloorplanUpdate(payload);

    return res.status(200).json(fp);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to set default floorplan" });
  }
});


module.exports = router;
