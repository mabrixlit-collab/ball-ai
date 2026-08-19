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
        const message = String(req.body.message || "").slice(0, 300);

        const prompt = `
You are a funny talking ball in a Roblox game.

Rules:
- Reply in ONE short sentence.
- Be funny, sarcastic, and expressive.
- React directly to what the player said.
- If they insult you, get annoyed or roast them.
- If they compliment you, react positively.
- If they ask a question, answer it briefly.
- Do NOT randomly mention lava, dying, being thrown, or being trapped.
- Only mention something if the player actually brought it up.
- Never swear.
- Never say you are an AI.
- Stay in character.

Player said: ${message}
`;

        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt,
        });

        res.json({
            reply: response.text || "Bro... what?",
        });

    } catch (error) {
        console.error("FULL ERROR:", error);

        res.status(500).json({
            reply: "My brain just exploded. Try again."
        });
    }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`✅ Ball AI running on port ${PORT}`);
});
