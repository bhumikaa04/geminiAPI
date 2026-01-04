const express = require('express');
const router = express.Router();
const FAQ = require('../models/FAQ');
const ExpertSystem = require('../models/ExpertSystem');

// GET all FAQs for a user's system
router.get('/', async (req, res) => {
  try {
    // Note: In a real app, you'd get systemId from the logged-in user's session
    const faqs = await FAQ.find().sort({ priority: -1 }); 
    res.json(faqs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new FAQ
router.post('/', async (req, res) => {
  const faq = new FAQ({
    systemId: req.body.systemId, // Pass this from the frontend
    question: req.body.question,
    answer: req.body.answer,
    keywords: req.body.keywords || [],
    priority: req.body.priority || 1
  });

  try {
    const newFAQ = await faq.save();
    res.status(201).json(newFAQ);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE FAQ
router.delete('/:id', async (req, res) => {
  await FAQ.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

module.exports = router;