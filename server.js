require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY is missing!");
    process.exit(1);
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
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
- Never swear.
- If the player is rude, become angrier.
- If the player is nice, be friendly.

Player: ${message}
`;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: prompt,
        });

        const reply = result.text || "I have nothing to say.";

        res.json({
            reply: reply,
        });

    } catch (err) {
        console.error("FULL ERROR:", err);

        res.status(500).json({
            reply: "Server Error",
        });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Ball AI running on port ${PORT}`);
});
