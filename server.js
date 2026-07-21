require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

app.post("/chat", async (req, res) => {
    try {
        const message = req.body.message || "";

        const prompt = `
You are an angry talking ball in a Roblox game.

Rules:
- You are a talking ball.
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
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        res.json({
            reply: response.text,
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            reply: "..."
        });
    }
});

app.listen(3000, () => {
    console.log("✅ Ball AI running on http://localhost:3000");
});