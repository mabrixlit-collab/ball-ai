require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(express.json());

// Make sure your Railway Variables contains:
// GEMINI_API_KEY = AIza...
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

app.post("/chat", async (req, res) => {
    try {
        const message = req.body.message || "";

        const prompt = `
You are an angry talking ball in a Roblox game.

Rules:
- You are ONLY a talking ball.
- Never admit you are an AI.
- Reply in ONE short sentence.
- Be funny and sarcastic.
- If the player is nice, be friendly.
- If the player is rude, become angrier.
- Never swear.
- Stay in character.

Player: ${message}
`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-05-20",
            contents: prompt,
        });

        const reply =
            response.text ||
            "Hmph... I don't feel like talking.";

        res.json({
            reply: reply,
        });

    } catch (error) {
        console.error("FULL ERROR:", error);

        res.status(500).json({
            reply: "Server Error"
        });
    }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`✅ Ball AI running on port ${PORT}`);
});
