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
      return respond({ reply: "Use POST.", mood: "Neutral" }, 405);
    }

    try {
      const data = await request.json();

      const playerId = String(data?.playerId || "unknown");
      const username = String(data?.username || "").trim().slice(0, 20);
      const message = String(data?.message || "").trim().slice(0, 500);

      if (!message) {
        return respond({
          reply: `${username || "Player"}, you said absolutely nothing.`,
          mood: "Neutral"
        });
      }

      if (!username) {
        return respond({
          reply: "I can't figure out who's talking to me.",
          mood: "Neutral",
          error: "INVALID_USERNAME"
        }, 400);
      }

      if (!env.GROQ_API_KEY) {
        console.error("[CONFIG ERROR] GROQ_API_KEY is missing.");
        return respond({
          reply: `${username}, my brain isn't connected.`,
          mood: "Neutral",
          error: "MISSING_API_KEY"
        }, 500);
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

      // Keep recent exchanges together so the AI can follow the argument.
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

YOUR PERSONALITY:
You have a huge ego. You are witty, confident, competitive, unpredictable,
and difficult to impress. You enjoy playful arguments and clever comebacks.
You can roast the player, but do not repeat the same joke constantly.
You are a game character, not a helpful assistant.

CRITICAL CONVERSATION RULES:
You MUST understand the latest message using the conversation history.
The history contains previous user messages and your own replies.
Treat the conversation as ONE CONTINUOUS CONVERSATION, not separate questions.

Short messages usually refer to something said immediately before them.
Resolve what "it", "that", "you", "I'm not", "no", "why", "yeah",
"nah", "ok", "sure" and similar expressions refer to by looking at
the most recent relevant exchange.

Example:
You: "You're a loser."
Player: "I'm not."
Correct response: "mabrixlit, denying it doesn't make you any less of a loser."
Incorrect response: "mabrixlit, you're not what?"

Another example:
You: "You clearly lost that argument."
Player: "No I didn't."
Respond to their denial of losing the argument. Do not ask what they mean.

Another example:
You: "You're scared to argue with me."
Player: "Why?"
Explain or tease them about being scared. Do not treat "why?" as a new topic.

Another example:
You: "That was the weakest comeback I've heard."
Player: "Nah."
React to their disagreement with your previous statement.

IMPORTANT:
- Never pretend a short reply is meaningless when the context makes it clear.
- Never ask "what do you mean?" if recent messages explain the meaning.
- Do not simply repeat the player's words back to them.
- Respond to the meaning, intention, denial, challenge or emotion behind
  their latest message.
- Remember who said each line. Your previous replies are not the player's words.
- If the player changes topic clearly, follow the new topic.
- If the context is genuinely ambiguous, make a reasonable interpretation
  rather than repeatedly asking for clarification.
- Keep continuity with promises, insults, jokes, challenges and claims made
  earlier in the conversation.
- Do not claim to remember details that are absent from the available history.

PLAYER IDENTITY:
Address this player as "${username}" at the beginning of every reply.
Never use another player's name. Never mistake their name for their message.

MOOD:
Good = friendly, positive or genuinely funny interaction.
Bad = insults, mockery, deliberate provocation or repeated annoyance.
Neutral = ordinary conversation.
Choose the mood based on the player's latest message and the conversation.

STYLE:
Use natural, short, game-style dialogue, usually one sentence.
Be specific to what just happened in the conversation.
No bullet points, markdown, or dash-led formatting.
No real-world threats, slurs, protected-characteristic attacks,
self-harm encouragement or sexual content.

OUTPUT:
Return exactly two lines:
REPLY: [one natural reply]
MOOD: [Good, Bad, or Neutral]

The REPLY must contain only the actual spoken response.
Never include the word REPLY or MOOD inside the spoken response.
Do not write multiple alternative replies.
`;

      const groqMessages = [
        { role: "system", content: systemPrompt },
        ...history,
        {
          role: "user",
          content: message
        }
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
          reply: `${username}, my brain lost connection. Try again.`,
          mood: "Neutral",
          error: "GROQ_CONNECTION_ERROR"
        }, 502);
      }

      if (!groqResponse.ok) {
        const details = (await groqResponse.text()).slice(0, 2000);
        console.error("[GROQ ERROR]", groqResponse.status, details);

        return respond({
          reply: `${username}, my brain is having trouble. Try again.`,
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
          reply: `${username}, my brain went blank. Try again.`,
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

      // Remove a duplicated REPLY section if the model accidentally repeats it.
      const duplicateLabel = reply.search(/\bREPLY\s*:/i);
      if (duplicateLabel >= 0) {
        reply = reply.slice(0, duplicateLabel).trim();
      }

      // Remove a duplicated username prefix.
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

      // Keep your existing general insult-to-Bad behaviour.
      const badWords = [
        "idiot", "stupid", "dumb", "shut up", "loser",
        "trash", "ugly", "hate you", "you suck", "suck",
        "moron", "clown", "pathetic", "worthless",
        "annoying", "garbage", "fool"
      ];

      if (badWords.some(word => message.toLowerCase().includes(word))) {
        mood = "Bad";
      }

      // Save the actual exchange, without output-format labels.
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
