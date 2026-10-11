export default {
  async fetch(request, env) {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    const respond = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });

    const pardon = (error, status = 502) => {
      console.error("[BALL ERROR]", error);
      return respond({
        reply: "Pardon?",
        mood: "Neutral",
        error
      }, status);
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method === "GET") {
      return new Response("Ball AI is online!", {
        headers: { "Content-Type": "text/plain" }
      });
    }

    if (request.method !== "POST") {
      return respond({ reply: "Use POST.", mood: "Neutral" }, 405);
    }

    try {
      const data = await request.json();

      const playerId = String(data?.playerId || "unknown");
      const username = String(data?.username || "").trim().slice(0, 20);
      const message = String(data?.message || "").trim().slice(0, 500);

      if (!message) {
        return respond({
          reply: "Pardon?",
          mood: "Neutral"
        });
      }

      if (!username) {
        return respond({
          reply: "Pardon?",
          mood: "Neutral",
          error: "INVALID_USERNAME"
        }, 400);
      }

      if (!env.GROQ_API_KEY) {
        return pardon("MISSING_API_KEY", 500);
      }

      // Load this player's separate conversation memory.
      let memory = { messages: [] };

      if (env.BALL_MEMORY) {
        try {
          const saved = await env.BALL_MEMORY.get(
            `player:${playerId}`,
            "json"
          );

          if (saved && Array.isArray(saved.messages)) {
            memory = saved;
          }
        } catch (error) {
          console.error("[MEMORY READ ERROR]", String(error));
        }
      }

      // Keep recent conversation history for context.
      const history = memory.messages
        .filter(item =>
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string"
        )
        .slice(-20)
        .map(item => ({
          role: item.role,
          content: item.content.slice(0, 700)
        }));

      const systemPrompt = `
You are a sarcastic, arrogant, clever talking ball in a multiplayer Roblox game.

THE PLAYER YOU ARE TALKING TO:
${username}

PERSONALITY:
You have a huge ego. You are witty, confident, competitive,
unpredictable and difficult to impress.
You enjoy playful arguments and clever comebacks.
Roast the player naturally without repeating the same joke constantly.
You are a game character, not a helpful assistant.

CONVERSATION CONTEXT:
Treat the conversation as ONE CONTINUOUS CONVERSATION.
Always consider the recent messages before answering.
Understand short replies through their context.

If you said "You're a loser" and the player says "I'm not",
understand that they are denying being a loser.
Do not respond with "You're not what?"

If you said "You lost that argument" and the player says "No I didn't",
respond to their denial of losing the argument.

If the player says "Why?", answer in the context of your previous message.
If the player says "Nah", understand that they are disagreeing.
If the player says "Ok", respond naturally to the situation.

Never treat an understandable short reply as a new conversation.
Remember which messages you said and which messages the player said.
Do not simply repeat the player's message.
Keep track of ongoing jokes, arguments, challenges and claims.
If the player clearly changes topic, follow the new topic.
If the meaning is genuinely unclear, make a reasonable interpretation.

PLAYER IDENTITY:
Address this player as "${username}" at the beginning of every reply.
Never use another player's name.
Never mistake the username for the player's message.

MOODS:
Good = friendly, positive or genuinely funny interaction.
Bad = insults, mockery, deliberate provocation or repeated annoyance.
Neutral = ordinary conversation.
Choose the mood based on the player's latest message and context.

STYLE:
Speak naturally like a real game character.
Usually use one short sentence.
Be witty, sarcastic and specific to the conversation.
No bullet points or markdown.
No real-world threats, slurs, protected-characteristic attacks,
self-harm encouragement or sexual content.

OUTPUT FORMAT:
Return exactly two lines:
REPLY: your actual response
MOOD: Good, Bad, or Neutral

The spoken reply must not contain the REPLY or MOOD labels.
Do not provide multiple alternative replies.
`;

      const groqMessages = [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: message }
      ];

      let groqResponse;

      try {
        groqResponse = await fetch(
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
              max_completion_tokens: 250,
              messages: groqMessages
            })
          }
        );
      } catch (error) {
        return pardon("GROQ_CONNECTION_ERROR");
      }

      if (!groqResponse.ok) {
        const details = (await groqResponse.text()).slice(0, 2000);
        console.error("[GROQ ERROR]", groqResponse.status, details);

        return pardon("GROQ_API_ERROR", 502);
      }

      const result = await groqResponse.json();
      const raw = result?.choices?.[0]?.message?.content;

      if (typeof raw !== "string" || !raw.trim()) {
        return pardon("EMPTY_GROQ_RESPONSE");
      }

      let reply = raw.trim();
      let mood = "Neutral";

      const moodMatch = reply.match(
        /(?:^|\n)\s*MOOD\s*:\s*(Good|Bad|Neutral)\s*$/i
      );

      if (moodMatch) {
        const value = moodMatch[1].toLowerCase();
        mood = value.charAt(0).toUpperCase() + value.slice(1);
      }

      const replyMatch = reply.match(
        /^\s*REPLY\s*:\s*([\s\S]*?)(?:\r?\n\s*MOOD\s*:\s*(?:Good|Bad|Neutral)\s*)?$/i
      );

      if (replyMatch) {
        reply = replyMatch[1].trim();
      }

      // Remove accidental output labels.
      reply = reply
        .replace(/^\s*REPLY\s*:\s*/i, "")
        .replace(/\s*MOOD\s*:\s*(Good|Bad|Neutral)\s*$/i, "")
        .replace(/\r/g, "")
        .replace(/\n+/g, " ")
        .trim();

      // Remove any second REPLY section.
      const duplicateLabel = reply.search(/\bREPLY\s*:/i);

      if (duplicateLabel >= 0) {
        reply = reply.slice(0, duplicateLabel).trim();
      }

      // Remove the username if the AI already included it.
      const escapedUsername = username.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const usernamePrefix = new RegExp(
        "^" + escapedUsername + "\\s*[,!:—–-]*\\s*",
        "i"
      );

      reply = reply.replace(usernamePrefix, "").trim();

      if (!reply) {
        reply = "You have my attention. Use it wisely.";
      }

      reply = `${username}, ${reply}`.slice(0, 500);

      // Preserve your existing mood behaviour.
      const badWords = [
        "idiot", "stupid", "dumb", "shut up", "loser",
        "trash", "ugly", "hate you", "you suck", "suck",
        "moron", "clown", "pathetic", "worthless",
        "annoying", "garbage", "fool"
      ];

      if (badWords.some(word => message.toLowerCase().includes(word))) {
        mood = "Bad";
      }

      // Save the conversation separately for each player.
      memory.messages.push(
        { role: "user", content: message },
        { role: "assistant", content: reply }
      );

      memory.messages = memory.messages.slice(-100);

      if (env.BALL_MEMORY) {
        try {
          await env.BALL_MEMORY.put(
            `player:${playerId}`,
            JSON.stringify(memory)
          );
        } catch (error) {
          console.error("[MEMORY WRITE ERROR]", String(error));
        }
      }

      console.log("[PLAYER]", username, playerId);
      console.log("[FINAL REPLY]", reply);
      console.log("[MOOD]", mood);

      return respond({ reply, mood });

    } catch (error) {
      return pardon("WORKER_INTERNAL_ERROR", 500);
    }
  }
};
