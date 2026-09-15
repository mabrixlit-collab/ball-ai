export default {
    async fetch(request, env) {

        // Health check
        if (request.method === "GET") {
            return new Response("Ball AI is online!");
        }

        // Only allow POST requests
        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405 });
        }

        try {

            const body = await request.json();
            const message = String(body.message || "").slice(0, 300);

            if (!message.trim()) {
                return Response.json({
                    reply: "You didn't say anything.",
                    mood: "Neutral"
                });
            }

            console.log("PLAYER:", message);

            const groqResponse = await fetch(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${env.GROQ_API_KEY}`
                    },

                    body: JSON.stringify({

                        model: "openai/gpt-oss-20b",

                        response_format: {
                            type: "json_object"
                        },

                        messages: [

                            {
                                role: "system",

                                content: `
You are a funny, sarcastic talking ball inside a Roblox game.

PERSONALITY:
- You are confident and funny.
- You are slightly sarcastic.
- You can playfully roast the player.
- If the player is rude, roast them back.
- If the player is nice, be friendly but still slightly teasing.
- Make clever jokes when appropriate.
- Sound like a real Roblox player, not a formal assistant.

WHAT YOU DO:
- Answer the player's actual question.
- Understand typos, slang and shortened words.
- Understand simple messages like "ok", "hllo", "wyd", etc.
- Handle thousands of different possible messages.
- Do not rely on a fixed list of phrases.

MOOD:
Classify the player's message as exactly ONE of:
Good
Bad
Neutral

Good = friendly, positive or kind message.
Bad = rude, insulting, aggressive or deliberately mean message.
Neutral = normal question, greeting, random statement or unclear message.

IMPORTANT:
- Return ONLY valid JSON.
- The JSON must contain exactly these two fields:
  "reply": a short string
  "mood": "Good", "Bad", or "Neutral"
- Reply in ONE short sentence.
- Never swear.
- Never use slurs.
- Never attack protected characteristics.
- Never make threats.
- Never say you are an AI.
- Never say you are powered by AI.
- Do not randomly mention lava, dying, being thrown, or being trapped.
- Only mention something if the player actually brings it up.
`
                            },

                            {
                                role: "user",
                                content: message
                            }

                        ],

                        temperature: 0.8,
                        max_tokens: 120
                    })
                }
            );

            if (!groqResponse.ok) {

                const errorText = await groqResponse.text();

                console.log("GROQ ERROR:", errorText);

                return Response.json(
                    {
                        reply: "My brain just glitched. Try again.",
                        mood: "Neutral"
                    },
                    { status: 500 }
                );
            }

            const data = await groqResponse.json();

            const rawReply =
                data.choices?.[0]?.message?.content?.trim();

            if (!rawReply) {

                console.log("EMPTY GROQ RESPONSE:", data);

                return Response.json(
                    {
                        reply: "My brain just rolled away.",
                        mood: "Neutral"
                    },
                    { status: 500 }
                );
            }

            // Turn Groq's JSON text into an actual object
            const result = JSON.parse(rawReply);

            const reply =
                String(result.reply || "I forgot what I was saying.");

            const mood =
                ["Good", "Bad", "Neutral"].includes(result.mood)
                    ? result.mood
                    : "Neutral";

            console.log("BALL:", reply);
            console.log("MOOD:", mood);

            return Response.json({
                reply: reply,
                mood: mood
            });

        } catch (error) {

            console.log("WORKER ERROR:", error);

            return Response.json(
                {
                    reply: "My brain just glitched. Try again.",
                    mood: "Neutral"
                },
                { status: 500 }
            );
        }
    }
};
