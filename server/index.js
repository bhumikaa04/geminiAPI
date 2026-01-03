require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose"); 
const User = require("./models/User") ; 

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error", err));

app.get("/", (req, res) => {
  res.send("Gemini API Server Running");
});

// routes
const contentRoutes = require("./routes/content.routes");
app.use("/api", contentRoutes);

const whatsappRoutes = require('./routes/whatsapp.routes');
app.use('/whatsapp', whatsappRoutes);

// Add this temporary route to test
app.get('/test-user/:phone', async (req, res) => {
  try {
    const phone = req.params.phone;
    const user = await User.findOne({ phone });
    
    if (!user) {
      return res.json({ error: 'User not found' });
    }
    
    // Check if expertSystem field exists in schema
    const schemaPaths = Object.keys(User.schema.paths);
    
    res.json({
      user,
      hasExpertSystemField: 'expertSystem' in user,
      expertSystemValue: user.expertSystem,
      expertSystemInSchema: schemaPaths.includes('expertSystem'),
      schemaPaths
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () =>
  console.log("Server running on http://localhost:3000")
);

