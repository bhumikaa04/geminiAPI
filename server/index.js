require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());

// FIXED: CORS for local React dev server
app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.get("/", (req, res) => {
  res.send("Gemini API Server Running");
});

// ---- Gemini Initialization ----
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error("ERROR: Missing Gemini API key in .env file");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash", // modern stable model
});

// ----- Helper for AI -----
async function generateContent(prompt) {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err) {
    console.error("Gemini error:", err);
    return "AI Error: Unable to generate response.";
  }
}

// ---- POST Route for chat ----
app.post("/api/content", async (req, res) => {
  try {
    const prompt = req.body.question;

    if (!prompt || prompt.trim() === "") {
      return res.json({ result: "Invalid request: empty question." });
    }

    const output = await generateContent(prompt);
    res.json({ result: output });

  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ result: "Server error occurred." });
  }
});

// ---- Start Server ----
app.listen(3000, () => console.log("Gemini server running on http://localhost:3000"));
