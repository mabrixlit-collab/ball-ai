export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health check
    if (request.method === "GET") {
      return new Response("Ball AI is online!", {
        headers: { "Content-Type": "text/plain" }
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const body = await request.json();

      const playerId = String(body.playerId || "");
      const message = String(body.message || "").trim();

      if (!playerId || !message) {
        return Response.json(
          { reply: "You forgot to actually say something.", mood: "Neutral" },
          { status: 400 }
        );
      }

      // -------------------------
      // LOAD PLAYER MEMORY
      // -------------------------

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

      // -------------------------
      // REMEMBER NAME
      // -------------------------

      const nameMatch = message.match(
        /(?:my name is|i'm|im|i am)\s+([A-Za-z0-9_]{2,20})/i
      );

      if (nameMatch) {
        memory.name = nameMatch[1];
      }

      // -------------------------
      // REMEMBER SIMPLE FACTS
      // -------------------------

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

          // Keep memory manageable
          if (memory.facts.length > 30) {
            memory.facts = memory.facts.slice(-30);
          }

          break;
        }
      }

      // -------------------------
      // ADD MESSAGE TO MEMORY
      // -------------------------

      memory.messages.push({
        role: "user",
        content: message
      });

      if (memory.messages.length > 12) {
        memory.messages = memory.messages.slice(-12);
      }

      // -------------------------
      // BUILD MEMORY TEXT
      // -------------------------

      let memoryText = "No stored information about this player.";

      if (
        memory.name ||
        memory.facts.length > 0 ||
        memory.messages.length > 0
      ) {
        memoryText = `
Player name:
${memory.name || "Unknown"}

Known facts:
${memory.facts.length ? memory.facts.join("\n") : "None"}

Recent conversation:
${memory.messages
  .map(m => `${m.role}: ${m.content}`)
  .join("\n")}
`;
      }

      // -------------------------
      // AI REQUEST
      // -------------------------

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
- Do not attack protected characteristics
- Do not sound like a professor
- Do not sound like a TikTok comment section
- Do not repeatedly say "bro", "genius", "nah", "fr", "you're cooked", "who let you cook", or similar clichés.
- Do not constantly use emojis.
- Use slightly sophisticated vocabulary naturally, usually only 1–3 bigger words in a response.
- Maximum 5 sophisticated words.
- Usually answer in ONE short sentence.
- Usually 6–20 words.
- If the player asks a genuine question, actually answer it.
- Understand typos, slang and badly written messages.
- If the player insults you, roast them back creatively without swearing.
- Do not repeat the same joke constantly.
- Avoid repeating recent replies.

MEMORY:
You have persistent memory for this specific player.

IMPORTANT MEMORY RULES:
- If the player's name is stored, remember it.
- If they ask "what's my name?", use the stored name.
- Never claim you forgot their name if it is stored.
- Use stored facts naturally when relevant.
- Do not invent facts that aren't in memory.
- Do not reveal internal memory systems.

PLAYER MEMORY:
${memoryText}

RECENT REPLIES TO AVOID:
${memory.recentReplies.length
  ? memory.recentReplies.join("\n")
  : "None"}

Return ONLY valid JSON in exactly this structure:

{
  "reply": "your response",
  "mood": "Good"
}

MOOD:
- Good = friendly, positive or appreciative message
- Bad = insulting, hostile, deliberately rude or antagonistic message
- Neutral = normal question, statement or conversation

The mood must be exactly one of:
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

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();

        console.error("GROQ ERROR:", errorText);

        return Response.json(
          {
            reply: "My brain just malfunctioned. Try again.",
            mood: "Neutral"
          },
          { status: 502 }
        );
      }

      const data = await aiResponse.json();

      const rawContent =
        data?.choices?.[0]?.message?.content;

      if (!rawContent) {
        throw new Error("No AI response");
      }

      let result;

      try {
        result = JSON.parse(rawContent);
      } catch {
        result = {
          reply: rawContent,
          mood: "Neutral"
        };
      }

      // -------------------------
      // CLEAN AI RESULT
      // -------------------------

      const reply =
        typeof result.reply === "string"
          ? result.reply.trim()
          : "My brain produced absolutely nothing useful.";

      const allowedMoods = ["Good", "Bad", "Neutral"];

      const mood = allowedMoods.includes(result.mood)
        ? result.mood
        : "Neutral";

      // -------------------------
      // SAVE AI REPLY
      // -------------------------

      memory.messages.push({
        role: "assistant",
        content: reply
      });

      if (memory.messages.length > 12) {
        memory.messages = memory.messages.slice(-12);
      }

      memory.recentReplies.push(reply);

      if (memory.recentReplies.length > 8) {
        memory.recentReplies = memory.recentReplies.slice(-8);
      }

      // -------------------------
      // SAVE MEMORY TO KV
      // -------------------------

      await env.BALL_MEMORY.put(
        memoryKey,
        JSON.stringify(memory)
      );

      // -------------------------
      // SEND RESULT TO ROBLOX
      // -------------------------

      return Response.json({
        reply,
        mood
      });

    } catch (error) {
      console.error("WORKER ERROR:", error);

      return Response.json(
        {
          reply: "My brain just malfunctioned. Try again.",
          mood: "Neutral"
        },
        { status: 500 }
      );
    }
  }
};
