const User = require("../models/User");
const ExpertSystem = require("../models/ExpertSystem");
const FAQ = require("../models/FAQ");
const matchFAQ = require("../utils/faqMatcher");
const { sendWhatsAppMessage } = require("../services/whatsapp.services");
const normalizePhone = require("../utils/normalizePhone"); 

async function handleIncomingMessage(req, res) {
  try {
    const from = req.body.From; // whatsapp:+91...
    const message = req.body.Body?.trim();

    if (!message) {
      return res.status(200).send("OK");
    }

    // Step 1: Find or create user
    const phone = normalizePhone(from.replace("whatsapp:", ""));
    console.log(`Processing message from ${phone}: "${message}"`);
    let user = await User.findOne({ phone });
    
    if (!user) {
      console.log(`Creating new user for ${phone}`);
      
      // Create expertSystem first
      const expertSystem = await ExpertSystem.create({
        ownerPhone: phone,
        name: `System for ${phone}`
      });
      
      console.log(`Created expertSystem: ${expertSystem._id}`);
      
      // Create user with expertSystem reference
      user = await User.create({
        phone,
        firstMessage: message,
        source: 'whatsapp',
        expertSystem: expertSystem._id
      });
      
      console.log(`Created user with expertSystem:`, {
        userId: user._id,
        expertSystemId: user.expertSystem
      });
      
      await sendWhatsAppMessage(
        from,
        "Welcome! I've set up your expert system. How can I help you today?"
      );
      return res.status(200).send("OK");
    }

    console.log(`Found existing user:`, {
      userId: user._id,
      hasExpertSystem: !!user.expertSystem
    });

    // Step 2: Ensure user has expertSystem
    if (!user.expertSystem) {
      console.log(`User ${user._id} has no expertSystem, creating one...`);
      
      let expertSystem = await ExpertSystem.findOne({ ownerPhone: user.phone });
      
      if (!expertSystem) {
        expertSystem = await ExpertSystem.create({
          ownerPhone: user.phone,
          name: `System for ${user.phone}`
        });
        console.log(`Created new expertSystem: ${expertSystem._id}`);
      } else {
        console.log(`Found existing expertSystem: ${expertSystem._id}`);
      }
      
      user.expertSystem = expertSystem._id;
      await user.save();
      console.log(`Updated user with expertSystem: ${expertSystem._id}`);
    }

    // Step 3: Get expertSystem
    const expertSystem = await ExpertSystem.findById(user.expertSystem);
    
    if (!expertSystem) {
      console.error(`ExpertSystem ${user.expertSystem} not found for user ${user._id}`);
      await sendWhatsAppMessage(
        from,
        "Sorry, there's a system configuration issue. Please contact support."
      );
      return res.status(200).send("OK");
    }

    console.log(`Using expertSystem:`, {
      systemId: expertSystem._id,
      fallbackType: expertSystem.fallbackType
    });

    // Step 4: Get FAQs and match
    const faqs = await FAQ.find({ systemId: expertSystem._id });
    console.log(`Found ${faqs.length} FAQs for this system`);
    
    const faqAnswer = matchFAQ(message, faqs);
    console.log(`FAQ match result:`, faqAnswer ? "Matched" : "No match");

    // Step 5: Determine response
    let replyText;
    if (faqAnswer) {
      replyText = faqAnswer;
    } else if (expertSystem.fallbackType === "gpt") {
      replyText = "AI response will be added later.";
    } else {
      replyText = "Thanks for your message. Our team will get back to you shortly.";
    }

    console.log(`Sending reply: "${replyText.substring(0, 50)}..."`);
    await sendWhatsAppMessage(from, replyText);
    res.status(200).send("OK");

  } catch (err) {
    console.error("WhatsApp Controller Error:", err.message);
    console.error("Full error:", err);
    res.status(500).send("Error");
  }
}

module.exports = { handleIncomingMessage };