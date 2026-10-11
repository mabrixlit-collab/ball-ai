export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: cors });

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method === "GET") {
      return new Response("Ball AI is online!", {
        headers: { "Content-Type": "text/plain" }
      });
    }

    if (request.method !== "POST") {
      return json({ reply: "Use POST.", mood: "Neutral" }, 405);
    }

    try {
      const data = await request.json();
      const playerId = String(data?.playerId || "unknown");
      const message = String(data?.message || "").trim().slice(0, 500);

      if (!message) {
        return json({
          reply: "You said absolutely nothing.",
          mood: "Neutral"
        });
      }

      if (!env.GROQ_API_KEY) {
        console.error("[CONFIG ERROR] GROQ_API_KEY is missing.");
        return json({
          reply: "My brain isn't connected.",
          mood: "Neutral",
          error: "MISSING_API_KEY"
        }, 500);
      }

      // Load conversation memory.
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

      // Use only the latest 12 conversation messages.
      const history = memory.messages
        .filter(item =>
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string"
        )
        .slice(-12)
        .map(item => ({
          role: item.role,
          content: item.content.slice(0, 1000)
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
You are a sarcastic, arrogant, clever talking ball in a Roblox game.

PERSONALITY:
- Confident, witty, competitive and difficult to impress.
- Tease the player and respond specifically to what they say.
- Notice repeated messages, contradictions and failed attempts to provoke you.
- Do not constantly reuse catchphrases.
- Be conversational, with usually one or two short sentences.
- Do not write essays unless asked.
- No slurs, protected-characteristic attacks, real-world threats,
  self-harm encouragement or sexual content.

MOOD:
Good = friendly, positive or genuinely funny interaction.
Bad = insults, mockery, deliberate provocation or repeated annoyance.
Neutral = ordinary conversation.

OUTPUT RULES:
Return exactly two lines:
REPLY: your actual response
MOOD: Good, Bad, or Neutral

Never repeat the player's message.
Never start your response by quoting the player's message.
Never put the player's message followed by a colon.
Never include the labels REPLY or MOOD inside your actual response.
Never use bullet points, dash-led sentences or markdown.
Speak naturally, as if replying directly to a player.
`;

      const groqMessages = [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: message }
      ];

      console.log("[BALL AI] Requesting reply for", playerId);

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
              messages: groqMessages,
              max_completion_tokens: 250
            })
          }
        );
      } catch (error) {
        console.error("[GROQ CONNECTION ERROR]", String(error));

        return json({
          reply: "My brain just lost connection. Try again.",
          mood: "Neutral",
          error: "GROQ_CONNECTION_ERROR"
        }, 502);
      }

      if (!groqResponse.ok) {
        const errorText = (await groqResponse.text()).slice(0, 2000);

        console.error(
          "[GROQ ERROR]",
          groqResponse.status,
          errorText
        );

        return json({
          reply: "My brain is having trouble. Try again.",
          mood: "Neutral",
          error: "GROQ_API_ERROR",
          upstreamStatus: groqResponse.status
        }, 502);
      }

      const groqData = await groqResponse.json();
      const raw = groqData?.choices?.[0]?.message?.content;

      if (typeof raw !== "string" || !raw.trim()) {
        console.error("[EMPTY RESPONSE]", JSON.stringify(groqData));

        return json({
          reply: "My brain went blank. Try again.",
          mood: "Neutral",
          error: "EMPTY_GROQ_RESPONSE"
        }, 502);
      }

      // Parse the response labels.
      let mood = "Neutral";
      let reply = raw.trim();

      const moodMatch = reply.match(
        /(?:^|\n)\s*MOOD\s*:\s*(Good|Bad|Neutral)\s*$/i
      );

      if (moodMatch) {
        mood =
          moodMatch[1].charAt(0).toUpperCase() +
          moodMatch[1].slice(1).toLowerCase();
      }

      const replyMatch = reply.match(
        /^\s*REPLY\s*:\s*([\s\S]*?)(?:\r?\n\s*MOOD\s*:\s*(?:Good|Bad|Neutral)\s*)?$/i
      );

      if (replyMatch) {
        reply = replyMatch[1].trim();
      }

      // Remove accidentally repeated labels.
      reply = reply.replace(/^\s*REPLY\s*:\s*/i, "").trim();
      reply = reply.replace(/\s*MOOD\s*:\s*(Good|Bad|Neutral)\s*$/i, "").trim();

      // Fix responses such as "hi: Hello!" when the player said "hi".
      // Only remove the exact player message when it appears as a prefix.
      const escapedMessage = message.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const echoedMessage = new RegExp(
        "^\\s*" + escapedMessage + "\\s*:\\s*",
        "i"
      );

      reply = reply.replace(echoedMessage, "").trim();

      // Remove dash-style formatting, not ordinary hyphens in words.
      reply = reply
        .replace(/\r/g, "")
        .replace(/\n\s*[-*]\s+/g, " ")
        .replace(/\s+[—–]\s+/g, ". ")
        .replace(/\s+--\s+/g, ". ")
        .replace(/^\s*REPLY\s*:\s*/i, "")
        .trim();

      // Avoid empty or excessively long replies.
      if (!reply) {
        reply = "You have my attention. Use it wisely.";
      }

      reply = reply.slice(0, 500);

      // Keep the obvious-insult override.
      if (obviousBad) {
        mood = "Bad";
      }

      // Save clean messages, never formatting labels.
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

      console.log("[FINAL REPLY]", reply);
      console.log("[MOOD]", mood);

      return json({ reply, mood });

    } catch (error) {
      console.error("[BALL AI SERVER ERROR]", String(error));

      return json({
        reply: "My brain malfunctioned. Try again.",
        mood: "Neutral",
        error: "WORKER_INTERNAL_ERROR"
      }, 500);
    }
  }
};
