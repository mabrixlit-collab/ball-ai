require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();

app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is missing!");
    process.exit(1);
}

const ai = new GoogleGenAI({
    apiKey: apiKey,
});

app.get("/", (req, res) => {
    res.send("✅ Ball AI Server is running!");
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

        console.log("✅ AI replied successfully.");

        res.json({
            reply: response.text,
        });

    } catch (error) {
        console.error("❌ FULL ERROR:");
        console.error(error);

        res.status(500).json({
            reply: error.message || "Unknown server error"
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`✅ Ball AI running on port ${PORT}`);
});