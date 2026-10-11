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

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method === "GET") {
      return new Response("Ball AI is online!", {
        headers: { "Content-Type": "text/plain" }
      });
    }

    if (request.method !== "POST") {
      return respond({
        reply: "Use POST.",
        mood: "Neutral"
      }, 405);
    }

    try {
      const data = await request.json();

      const playerId = String(data?.playerId || "unknown");
      const username = String(data?.username || "").trim();
      const message = String(data?.message || "").trim().slice(0, 500);

      if (!message) {
        return respond({
          reply: "You said absolutely nothing.",
          mood: "Neutral"
        });
      }

      if (!username || username.length > 20) {
        return respond({
          reply: "I can't figure out who's talking to me.",
          mood: "Neutral",
          error: "INVALID_USERNAME"
        }, 400);
      }

      if (!env.GROQ_API_KEY) {
        console.error("[CONFIG ERROR] GROQ_API_KEY is missing.");

        return respond({
          reply: "My brain isn't connected.",
          mood: "Neutral",
          error: "MISSING_API_KEY"
        }, 500);
      }

      // Keep each player's memory separate.
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

      // Limit prompt size so conversations don't grow endlessly.
      const history = memory.messages
        .filter(item =>
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string"
        )
        .slice(-12)
        .map(item => ({
          role: item.role,
          content: item.content.slice(0, 700)
        }));

      const badWords = [
        "idiot", "stupid", "dumb", "shut up", "loser",
        "trash", "ugly", "hate you", "you suck", "suck",
        "moron", "clown", "pathetic", "worthless",
        "annoying", "garbage", "fool"
      ];

      const obviousBad = badWords.some(word =>
        message.toLowerCase().includes(word)
      );

      const systemPrompt = `
You are a sarcastic, arrogant, clever talking ball in a multiplayer Roblox game.

CURRENT PLAYER USERNAME: ${username}

PERSONALITY:
You have a huge ego. You are witty, confident, competitive,
unpredictable and difficult to impress.
Tease the player and respond specifically to what they say.
Notice repeated messages, contradictions and failed attempts to provoke you.
Avoid repetitive catchphrases.
Usually answer in one or two short sentences.
Do not act like a normal helpful assistant.

PLAYER IDENTITY:
You are speaking to the player whose exact username is "${username}".
Address that player by their username at the start of every reply.
Never use another player's username.
Never confuse the username with the player's message.
Do not repeat the player's message.

MOODS:
Good = friendly, positive or genuinely funny interaction.
Bad = insults, mockery, deliberate provocation or repeated annoyance.
Neutral = ordinary conversation.

STYLE:
Speak naturally, like a real game character.
No bullet points or dash-led sentences.
No markdown.
No real-world threats, slurs, protected-characteristic attacks,
self-harm encouragement or sexual content.

OUTPUT FORMAT:
Return exactly two lines:
REPLY: your actual response
MOOD: Good

The mood line must be Good, Bad, or Neutral.
Never put REPLY or MOOD inside the actual response.
Never repeat either label.
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
        console.error("[GROQ CONNECTION ERROR]", String(error));

        return respond({
          reply: "My brain lost connection. Try again.",
          mood: "Neutral",
          error: "GROQ_CONNECTION_ERROR"
        }, 502);
      }

      if (!groqResponse.ok) {
        const details = (await groqResponse.text()).slice(0, 2000);

        console.error(
          "[GROQ ERROR]",
          groqResponse.status,
          details
        );

        return respond({
          reply: "My brain is having trouble. Try again.",
          mood: "Neutral",
          error: "GROQ_API_ERROR",
          upstreamStatus: groqResponse.status
        }, 502);
      }

      const result = await groqResponse.json();
      const raw = result?.choices?.[0]?.message?.content;

      if (typeof raw !== "string" || !raw.trim()) {
        console.error("[EMPTY GROQ RESPONSE]", JSON.stringify(result));

        return respond({
          reply: "My brain went blank. Try again.",
          mood: "Neutral",
          error: "EMPTY_GROQ_RESPONSE"
        }, 502);
      }

      let reply = raw.trim();
      let mood = "Neutral";

      const moodMatch = reply.match(
        /(?:^|\n)\s*MOOD\s*:\s*(Good|Bad|Neutral)\s*$/i
      );

      if (moodMatch) {
        mood = moodMatch[1].toLowerCase();
        mood = mood[0].toUpperCase() + mood.slice(1);
      }

      const replyMatch = reply.match(
        /^\s*REPLY\s*:\s*([\s\S]*?)(?:\r?\n\s*MOOD\s*:\s*(?:Good|Bad|Neutral)\s*)?$/i
      );

      if (replyMatch) {
        reply = replyMatch[1].trim();
      }

      // Strip accidental formatting labels.
      reply = reply
        .replace(/^\s*REPLY\s*:\s*/i, "")
        .replace(/\s*MOOD\s*:\s*(Good|Bad|Neutral)\s*$/i, "")
        .trim();

      // Remove the player's message if the model echoes it.
      const escapedMessage = message.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const echoedMessage = new RegExp(
        "^\\s*" + escapedMessage + "\\s*:\\s*",
        "i"
      );

      reply = reply.replace(echoedMessage, "").trim();

      // Remove accidental dash formatting.
      reply = reply
        .replace(/\r/g, "")
        .replace(/\n\s*[-*]\s+/g, " ")
        .replace(/\s+[—–]\s+/g, ". ")
        .replace(/\s+--\s+/g, ". ")
        .trim();

      // Ensure the actual Roblox username appears exactly once at the start.
      const usernamePrefix = new RegExp(
        "^" + username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        "\\s*[,!:—–-]*\\s*",
        "i"
      );

      reply = reply.replace(usernamePrefix, "").trim();

      if (!reply) {
        reply = "You have my attention. Use it wisely.";
      }

      reply = `${username}, ${reply}`.slice(0, 500);

      if (obviousBad) {
        mood = "Bad";
      }

      // Save the clean conversation separately for each player.
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
      console.error("[BALL AI SERVER ERROR]", String(error));

      return respond({
        reply: "My brain malfunctioned. Try again.",
        mood: "Neutral",
        error: "WORKER_INTERNAL_ERROR"
      }, 500);
    }
  }
};
