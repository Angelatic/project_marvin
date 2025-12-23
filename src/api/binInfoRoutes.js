const express = require("express");
const router = express.Router();

const binInfoService = require("../core/binInfoService");
const { validateBinInfoJson } = require("../util/validation");

router.post("/", async (req, res) => {
  const err = validateBinInfoJson(req.body);
  if (err) return res.status(400).json({ error: err });

  try {
    const result = await binInfoService.upsertFromSapJson(req.body);
    return res.status(200).json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to upsert bininfo" });
  }
});

module.exports = router;
