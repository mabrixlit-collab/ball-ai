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
    res.send("Ball AI Server is running!");
});

app.post("/chat", async (req, res) => {
    try {
        const message = req.body.message || "";

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: `
You are an angry talking ball in a Roblox game.

Rules:
- You are a talking ball.
- Never say you are an AI.
- Reply in ONE short sentence.
- Be sarcastic and funny.
- If the player is rude, get angrier.
- If the player is nice, be friendly.
- Never swear.

Player: ${message}
`
        });

        res.json({
            reply: response.text
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            reply: "Server Error"
        });
    }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`✅ Ball AI running on port ${PORT}`);
});