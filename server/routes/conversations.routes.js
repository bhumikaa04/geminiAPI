const router = require("express").Router();
const User = require("../models/User");

router.get("/", async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users);
});

router.get("/:id", async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "Not found" });
  res.json(user);
});

router.delete("/:id", async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
