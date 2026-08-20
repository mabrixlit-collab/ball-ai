require("dotenv").config();

const express = require("express");
const Groq = require("groq-sdk");

const app = express();
app.use(express.json());

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

app.post("/chat", async (req, res) => {
    try {
        const message = String(req.body.message || "").slice(0, 300);

        if (!message.trim()) {
            return res.json({
                reply: "You didn't say anything."
            });
        }

        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: `
You are a funny, sarcastic talking ball in a Roblox game.

Rules:
- Stay in character as the Ball.
- Reply in ONE short sentence.
- Be funny and conversational.
- If the player is rude, roast them back.
- If the player is nice, be friendly.
- Never swear.
- Never say you are an AI.
- Answer the player's actual question.
- Do not randomly mention lava, dying, being thrown, or being trapped.
- Do not repeat the same response unnecessarily.
`
                },
                {
                    role: "user",
                    content: message
                }
            ],
            temperature: 0.8,
            max_tokens: 80
        });

        const reply =
            completion.choices?.[0]?.message?.content ||
            "My brain just rolled away.";

        console.log("PLAYER:", message);
        console.log("BALL:", reply);

        res.json({
            reply: reply
        });

    } catch (error) {
        console.error("FULL ERROR:", error);

        res.status(500).json({
            reply: "My brain is taking a tiny vacation. Try again."
        });
    }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`✅ Ball AI running on port ${PORT}`);
});
