const express = require("express");
const router = express.Router();
const ExpertSystem = require("../models/ExpertSystem");

router.get("/me", async (req, res) => {
  try {
    const system = await ExpertSystem.findOne();

    if (!system) {
      return res.status(404).json({ message: "No expert system found" });
    }

    res.json(system);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
