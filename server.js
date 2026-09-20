export default {
  async fetch(request, env) {

    try {

      // =========================
      // HEALTH CHECK
      // =========================

      if (request.method === "GET") {
        return new Response("Ball AI is online!");
      }


      // =========================
      // READ ROBLOX MESSAGE
      // =========================

      const body = await request.json();

      const playerId = String(body.playerId || "");
      const message = String(body.message || "").trim();

      if (!playerId || !message) {
        return Response.json({
          reply: "You sent me absolutely nothing.",
          mood: "Neutral"
        }, { status: 400 });
      }


      // =========================
      // LOAD KV MEMORY
      // =========================

      const key = `player:${playerId}`;

      let memory = await env.BALL_MEMORY.get(
        key,
        { type: "json" }
      );

      if (!memory) {
        memory = {
          name: null,
          messages: []
        };
      }


      // =========================
      // REMEMBER NAME
      // =========================

      const nameMatch = message.match(
        /(?:my name is|i'm|im|i am)\s+([A-Za-z0-9_]{2,20})/i
      );

      if (nameMatch) {
        memory.name = nameMatch[1];
      }


      // =========================
      // ADD MESSAGE TO MEMORY
      // =========================

      memory.messages.push({
        role: "user",
        content: message
      });

      if (memory.messages.length > 10) {
        memory.messages = memory.messages.slice(-10);
      }


      // =========================
      // BUILD MEMORY
      // =========================

      const memoryText = `
Player name: ${memory.name || "Unknown"}

Recent conversation:
${memory.messages
  .map(m => `${m.role}: ${m.content}`)
  .join("\n")}
`;


      // =========================
      // ASK GROQ
      // =========================

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

            reasoning_effort: "low",

            include_reasoning: false,

            response_format: {
              type: "json_object"
            },

            messages: [

              {
                role: "system",

                content: `
You are a talking ball in a Roblox game.

Personality:
- casual
- clever
- sarcastic
- very disrespectful when someone is rude
- friendly when someone is friendly
- never swear
- never use slurs
- never threaten people
- don't constantly use slang
- don't constantly use emojis
- don't constantly say "bro", "nah", "fr", "genius", "you're cooked", or "who let you cook"
- use occasional sophisticated vocabulary while still sounding natural
- usually use 1–3 slightly sophisticated words
- maximum 5 sophisticated words
- usually reply in one short sentence
- usually 6–20 words

Actually answer genuine questions.

Understand typos and slang.

If someone asks your player a normal question, answer it normally.

If someone insults you, roast them intelligently.

If the player asks their name and you know it, tell them.

Never pretend you forgot information that is in the memory.

Return ONLY valid JSON:

{
  "reply": "your response",
  "mood": "Neutral"
}

Mood must be exactly:
Good
Bad
Neutral

Good = friendly or positive.

Bad = insulting, hostile or deliberately rude.

Neutral = normal questions, greetings or ordinary statements.

PLAYER MEMORY:
${memoryText}
`
              },

              {
                role: "user",
                content: message
              }

            ]

          })
        }
      );


      // =========================
      // SHOW REAL GROQ ERROR
      // =========================

      if (!groqResponse.ok) {

        const errorText = await groqResponse.text();

        console.error(
          "GROQ ERROR:",
          groqResponse.status,
          errorText
        );

        return Response.json({

          reply:
            "GROQ ERROR " +
            groqResponse.status +
            ": " +
            errorText,

          mood: "Neutral"

        }, {
          status: 500
        });
      }


      // =========================
      // READ GROQ RESPONSE
      // =========================

      const groqData = await groqResponse.json();

      const content =
        groqData.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error(
          "Groq returned no content."
        );
      }


      // =========================
      // PARSE AI JSON
      // =========================

      let result;

      try {

        result = JSON.parse(content);

      } catch (error) {

        throw new Error(
          "Invalid AI JSON: " + content
        );
      }


      // =========================
      // GET REPLY
      // =========================

      const reply = String(
        result.reply ||
        "My brain has temporarily left the building."
      );


      // =========================
      // GET MOOD
      // =========================

      let mood = String(
        result.mood || "Neutral"
      );

      if (
        mood !== "Good" &&
        mood !== "Bad" &&
        mood !== "Neutral"
      ) {
        mood = "Neutral";
      }


      // =========================
      // SAVE AI RESPONSE
      // =========================

      memory.messages.push({
        role: "assistant",
        content: reply
      });

      if (memory.messages.length > 10) {
        memory.messages = memory.messages.slice(-10);
      }


      // =========================
      // SAVE TO KV
      // =========================

      await env.BALL_MEMORY.put(
        key,
        JSON.stringify(memory)
      );


      // =========================
      // SEND TO ROBLOX
      // =========================

      return Response.json({
        reply: reply,
        mood: mood
      });


    } catch (error) {

      console.error(
        "BALL AI ERROR:",
        error
      );

      return Response.json({

        reply:
          "Something malfunctioned: " +
          (error?.message || String(error)),

        mood: "Neutral"

      }, {
        status: 500
      });

    }

  }
};
