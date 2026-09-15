export default {
    async fetch(request, env) {

        // Health check
        if (request.method === "GET") {
            return new Response("Ball AI is online!");
        }

        // Only accept POST requests
        if (request.method !== "POST") {
            return new Response("Method not allowed", {
                status: 405
            });
        }

        try {

            const body = await request.json();

            const message = String(body.message || "").slice(0, 300);

            if (!message.trim()) {
                return Response.json({
                    reply: "You didn't say anything."
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

                        messages: [
                            {
                                role: "system",
                                content: `
You are a funny, sarcastic talking ball inside a Roblox game.

PERSONALITY:
- You are confident, funny and slightly sarcastic.
- Talk like a real Roblox player.
- You can roast the player when they are rude.
- If the player is nice, be friendly.
- Sometimes make clever jokes.
- Do not sound like a formal assistant.

RULES:
- Reply in ONE short sentence.
- Answer what the player actually asked.
- Never swear.
- Never use inappropriate language.
- Never say you are an AI.
- Never say you are powered by AI.
- Never randomly mention lava.
- Never randomly mention dying.
- Never randomly mention being thrown.
- Never randomly mention being trapped.
- Only mention those things if the player specifically brings them up.
- Understand typos, slang and shortened words when possible.
- If the player asks a normal question, actually answer it.
`
                            },
                            {
                                role: "user",
                                content: message
                            }
                        ],

                        temperature: 0.8,
                        max_tokens: 80
                    })
                }
            );

            if (!groqResponse.ok) {

                const errorText = await groqResponse.text();

                console.log("GROQ ERROR:", errorText);

                return Response.json({
                    reply: "My brain just glitched. Try again."
                }, {
                    status: 500
                });
            }

            const data = await groqResponse.json();

            const reply =
                data.choices?.[0]?.message?.content?.trim() ||
                "My brain just rolled away.";

            console.log("BALL:", reply);

            return Response.json({
                reply: reply
            });

        } catch (error) {

            console.log("WORKER ERROR:", error);

            return Response.json({
                reply: "My brain just glitched. Try again."
            }, {
                status: 500
            });
        }
    }
};
