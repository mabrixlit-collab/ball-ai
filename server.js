export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      // Health check
      if (request.method === "GET") {
        return new Response("Ball AI is online!", {
          headers: {
            "Content-Type": "text/plain"
          }
        });
      }

      if (request.method !== "POST") {
        return Response.json(
          { error: "Method not allowed" },
          { status: 405 }
        );
      }

      // Read Roblox request
      const body = await request.json();

      const playerId = String(body.playerId || "").trim();
      const message = String(body.message || "").trim();

      console.log("PLAYER ID:", playerId);
      console.log("MESSAGE:", message);

      if (!playerId || !message) {
        return Response.json(
          {
            reply: "You forgot to actually say something.",
            mood: "Neutral"
          },
          { status: 400 }
        );
      }

      // -----------------------------
      // LOAD PLAYER MEMORY
      // -----------------------------

      const memoryKey = `player:${playerId}`;

      let memory = await env.BALL_MEMORY.get(memoryKey, {
        type: "json"
      });

      if (!memory) {
        memory = {
          name: null,
          facts: [],
          messages: [],
          recentReplies: []
        };
      }

      // -----------------------------
      // REMEMBER NAME
      // -----------------------------

      const nameMatch = message.match(
        /(?:my name is|i'm|im|i am)\s+([A-Za-z0-9_]{2,20})/i
      );

      if (nameMatch) {
        memory.name = nameMatch[1];

        console.log("REMEMBERED NAME:", memory.name);
      }

      // -----------------------------
      // REMEMBER SIMPLE FACTS
      // -----------------------------

      const factPatterns = [
        /^(?:i like|i love|i hate|i play|i'm from|im from)\s+(.+)/i,
        /^my favorite (.+?) is (.+)$/i
      ];

      for (const pattern of factPatterns) {
        const match = message.match(pattern);

        if (match) {
          const fact = match[0];

          if (!memory.facts.includes(fact)) {
            memory.facts.push(fact);
          }

          if (memory.facts.length > 30) {
            memory.facts = memory.facts.slice(-30);
          }

          break;
        }
      }

      // -----------------------------
      // ADD USER MESSAGE
      // -----------------------------

      memory.messages.push({
        role: "user",
        content: message
      });

      if (memory.messages.length > 12) {
        memory.messages = memory.messages.slice(-12);
      }

      // -----------------------------
      // MEMORY TEXT
      // -----------------------------

      const memoryText = `
Player name:
${memory.name || "Unknown"}

Known facts:
${memory.facts.length
  ? memory.facts.join("\n")
  : "None"}

Recent conversation:
${memory.messages.length
  ? memory.messages
      .map(m => `${m.role}: ${m.content}`)
      .join("\n")
  : "None"}
`;

      // -----------------------------
      // CHECK GROQ KEY
      // -----------------------------

      if (!env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is missing");
      }

      // -----------------------------
      // SEND TO GROQ
      // -----------------------------

      console.log("CONTACTING GROQ...");

      const aiResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",

          headers: {
            "Authorization": `Bearer ${env.GROQ_API_KEY}`,
            "Content-Type": "application/json"
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
You are a talking ball inside a Roblox game.

PERSONALITY:
- Casual
- Clever
- Extremely disrespectful when the player is rude
- Friendly when the player is genuinely nice
- Sarcastic
- Never swear
- Never use slurs
- Never threaten anyone
- Never attack protected characteristics
- Do not sound like a professor
- Do not sound like a TikTok comment section
- Do not constantly use "bro", "genius", "nah", "fr", "you're cooked", "who let you cook", or similar clichés.
- Do not constantly use emojis.
- Use slightly sophisticated vocabulary naturally.
- Usually use only 1–3 sophisticated words.
- Maximum 5 sophisticated words.
- Usually answer in one short sentence.
- Usually 6–20 words.
- If the player asks a genuine question, actually answer it.
- Understand typos and slang.
- If the player insults you, roast them back creatively without swearing.
- Do not repeat the same joke constantly.
- Avoid repeating recent replies.

MEMORY:
You have persistent memory for this specific player.

If their name is stored and they ask for their name, use it.
Never claim you forgot a stored name.
Use stored facts naturally when relevant.
Never invent facts.
Never reveal the internal memory system.

PLAYER MEMORY:
${memoryText}

RECENT REPLIES:
${memory.recentReplies.length
  ? memory.recentReplies.join("\n")
  : "None"}

Return ONLY valid JSON:

{
  "reply": "your response",
  "mood": "Good"
}

MOOD:
Good = friendly or positive
Bad = insulting, hostile or deliberately rude
Neutral = normal question or statement

The mood MUST be exactly:
Good
Bad
Neutral
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

      console.log("GROQ STATUS:", aiResponse.status);

      // -----------------------------
      // GROQ ERROR
      // -----------------------------

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();

        console.error(
          "GROQ ERROR:",
          aiResponse.status,
          errorText
        );

        return Response.json(
          {
            reply: `Groq error ${aiResponse.status}`,
            mood: "Neutral"
          },
          { status: 502 }
        );
      }

      // -----------------------------
      // READ GROQ RESPONSE
      // -----------------------------

      const data = await aiResponse.json();

      console.log("GROQ RESPONSE RECEIVED");

      const rawContent =
        data?.choices?.[0]?.message?.content;

      if (!rawContent) {
        throw new Error("Groq returned no message content");
      }

      console.log("AI CONTENT:", rawContent);

      let result;

      try {
        result = JSON.parse(rawContent);
      } catch (error) {
        console.error("JSON PARSE ERROR:", error);

        result = {
          reply: rawContent,
          mood: "Neutral"
        };
      }

      // -----------------------------
      // CLEAN RESULT
      // -----------------------------

      const reply =
        typeof result.reply === "string" &&
        result.reply.trim()
          ? result.reply.trim()
          : "My brain produced absolutely nothing useful.";

      const allowedMoods = [
        "Good",
        "Bad",
        "Neutral"
      ];

      const mood = allowedMoods.includes(result.mood)
        ? result.mood
        : "Neutral";

      // -----------------------------
      // SAVE ASSISTANT RESPONSE
      // -----------------------------

      memory.messages.push({
        role: "assistant",
        content: reply
      });

      if (memory.messages.length > 12) {
        memory.messages = memory.messages.slice(-12);
      }

      memory.recentReplies.push(reply);

      if (memory.recentReplies.length > 8) {
        memory.recentReplies =
          memory.recentReplies.slice(-8);
      }

      // -----------------------------
      // SAVE MEMORY
      // -----------------------------

      await env.BALL_MEMORY.put(
        memoryKey,
        JSON.stringify(memory)
      );

      console.log("MEMORY SAVED");

      // -----------------------------
      // SEND TO ROBLOX
      // -----------------------------

      return Response.json({
        reply: reply,
        mood: mood
      });

    } catch (error) {

      console.error(
        "WORKER ERROR:",
        error
      );

      return Response.json(
        {
          reply: `ERROR: ${error?.message || String(error)}`,
          mood: "Neutral"
        },
        { status: 500 }
      );
    }
  }
};
