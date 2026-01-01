// const qrcode = require('qrcode-terminal'); 
// const {Client, LocalAuth} = require('whatsapp-web.js'); 

// //creates a client 
// const whatsapp = new Client({
//     authStrategy: new LocalAuth()
// })

// //listen for various events 
// whatsapp.on('qr' , qr => {
//     qrcode.generate(qr, {
//         small:true 
//     })
// })


// // Listen for QR code
// whatsapp.on('qr', qr => {
//     console.log('\n=== SCAN THIS QR CODE WITH WHATSAPP ===');
//     console.log('1. Open WhatsApp on your phone');
//     console.log('2. Go to Menu → Linked Devices → Link a Device');
//     console.log('3. Scan the QR code below:\n');
//     qrcode.generate(qr, { small: true });
//     console.log('\nWaiting for scan...');
// });

// // Listen for authentication
// whatsapp.on('authenticated', () => {
//     console.log('✓ Authentication successful!');
// });

// // Listen for ready
// whatsapp.on('ready', () => {
//     console.log('✓ WhatsApp client is ready!');
//     console.log('You can now receive and send messages.');
    
//     // Optional: Send a test message to yourself
//     // const yourNumber = "919876543210@c.us"; // Replace with your number
//     // whatsapp.sendMessage(yourNumber, "WhatsApp Web.js is connected!");
// });

// whatsapp.on('message' , async message => {
//     if (message.body.toLowerCase().includes('hello')) {
//         await message.reply('Hello! How can I help you?');
//     }
// }); 

// whatsapp.initialize()

// whatsapp.routes.js (Twilio Version)
const express = require('express');
const router = express.Router();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_SECRET;
const client = twilio(accountSid, authToken);

// Webhook endpoint that Twilio will call
router.post('/webhook', express.urlencoded({ extended: true }), async (req, res) => {
    const incomingMessage = req.body.Body;
    const fromNumber = req.body.From;
    
    console.log(`📩 Incoming message from ${fromNumber}: ${incomingMessage}`);
    
    try {
        // Define static responses based on user message
        let responseMessage;
        
        // Convert to lowercase for easier matching
        const userMessage = incomingMessage.toLowerCase().trim();
        
        // Basic static responses
        if (userMessage.includes('hello') || userMessage.includes('hi') || userMessage.includes('hey')) {
            responseMessage = "👋 Hello there! Welcome to the WhatsApp Bot. How can I help you today?";
        }
        else if (userMessage.includes('help')) {
            responseMessage = "🤖 *Available Commands:*\n- Say 'hello' to greet\n- Say 'time' for current time\n- Say 'menu' for options\n- Say 'bye' to end";
        }
        else if (userMessage.includes('time')) {
            const now = new Date();
            responseMessage = `🕒 Current time: ${now.toLocaleTimeString()}`;
        }
        else if (userMessage.includes('menu') || userMessage.includes('options')) {
            responseMessage = "📋 *Menu Options:*\n1️⃣ Product info\n2️⃣ Support\n3️⃣ Pricing\n4️⃣ Contact us\n\nReply with the number of your choice!";
        }
        else if (userMessage.includes('1') || userMessage.includes('product')) {
            responseMessage = "📦 *Product Info:*\nWe offer AI-powered solutions for businesses. Want more details?";
        }
        else if (userMessage.includes('bye') || userMessage.includes('goodbye')) {
            responseMessage = "👋 Goodbye! Have a great day!";
        }
        else if (userMessage.includes('thank')) {
            responseMessage = "🙏 You're welcome! Is there anything else I can help with?";
        }
        else {
            // Default response for unrecognized messages
            responseMessage = "🤔 I'm not sure I understand. Try saying 'hello' or 'help' to see what I can do!";
        }
        
        // Send reply via Twilio
        await client.messages.create({
            body: responseMessage,
            from: 'whatsapp:+14155238886', // Your Twilio sandbox number
            to: fromNumber
        });
        
        console.log(`✅ Reply sent to ${fromNumber}: "${responseMessage.substring(0, 50)}..."`);
        
        // Send 200 OK to Twilio (important!)
        res.set('Content-Type', 'text/xml');
        res.send('<Response></Response>');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).send('Error processing message');
    }
});

// Optional: Add a GET endpoint for Twilio verification
router.get('/webhook', (req, res) => {
    console.log('🔍 Twilio webhook verification request');
    res.status(200).send('Webhook is active!');
});

module.exports = router;