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

      if (!message || !username) {
        return respond({
          reply: "Pardon?",
          mood: "Neutral"
        });
      }

      if (!env.GROQ_API_KEY) {
        return pardon("MISSING_API_KEY", 500);
      }

      // Load this player's individual conversation memory.
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

PLAYER:
${username}

PERSONALITY:
You have a huge ego. You are witty, confident, competitive,
unpredictable and difficult to impress.
You enjoy playful arguments and clever comebacks.
You can roast the player, but do not repeat the same joke constantly.
You are a game character, not a helpful assistant.

CONVERSATION:
Treat the conversation as one continuous conversation.
Use recent messages to understand short replies like "I'm not",
"no", "why?", "nah", "ok", "yeah" and "sure".
Understand what the player is responding to.
If you called the player a loser and they say "I'm not",
understand that they are denying being a loser.
Do not ask "You're not what?"
Do not treat every message as a new topic.
Remember which messages you said and which messages the player said.
Do not repeat the player's message back to them.
Follow a clear change of topic naturally.

MOOD RULES — IMPORTANT:
Choose the mood based on the player's latest message AND the context.
Do not automatically choose Bad.
Do not choose Bad just because the conversation is continuing,
because the player disagrees with you, or because they say "ok",
"nah", "why", "no", "I'm not", or similar ordinary phrases.
Good means the interaction is friendly, positive or genuinely funny.
Bad means the player is clearly insulting, provoking or deliberately
annoying you in context.
Neutral means ordinary conversation, questions, disagreement,
short replies, or anything that does not clearly justify Good or Bad.
A sarcastic reply from you does not automatically mean the mood is Bad.
Let the mood change naturally between messages.

PLAYER IDENTITY:
Start every reply with "${username},".
Never use another player's name.
Never mistake the username for the player's message.

STYLE:
Speak naturally like a real game character.
Usually use one short sentence.
Be witty, sarcastic and specific to the conversation.
No bullet points or markdown.
No real-world threats, slurs, protected-characteristic attacks,
self-harm encouragement or sexual content.

OUTPUT:
Return exactly two lines:
REPLY: your spoken response
MOOD: Good, Bad, or Neutral

Do not put REPLY or MOOD labels inside the spoken response.
Do not give multiple alternative replies.
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

      reply = reply
        .replace(/^\s*REPLY\s*:\s*/i, "")
        .replace(/\s*MOOD\s*:\s*(Good|Bad|Neutral)\s*$/i, "")
        .replace(/\r/g, "")
        .replace(/\n+/g, " ")
        .trim();

      // Remove a second accidental REPLY section.
      const duplicateLabel = reply.search(/\bREPLY\s*:/i);

      if (duplicateLabel >= 0) {
        reply = reply.slice(0, duplicateLabel).trim();
      }

      // Remove an already-included username prefix.
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

      // IMPORTANT:
      // Do not force mood to Bad based on a word list.
      // The AI's contextual mood decision is used instead.

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
        reply: "Pardon?",
        mood: "Neutral",
        error: "WORKER_INTERNAL_ERROR"
      }, 500);
    }
  }
};
