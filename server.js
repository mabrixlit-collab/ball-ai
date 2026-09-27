export default {
  async fetch(request, env) {

    // =========================================================
    // BALL AI — CLOUDFLARE WORKER
    // =========================================================

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // =========================================================
    // CORS PREFLIGHT
    // =========================================================

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // =========================================================
    // HEALTH CHECK
    // =========================================================

    if (request.method === "GET") {
      return new Response("Ball AI is online!", {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain"
        }
      });
    }

    // =========================================================
    // ONLY POST
    // =========================================================

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          reply: "Method not allowed.",
          mood: "Neutral"
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );
    }

    try {

      // =======================================================
      // READ REQUEST
      // =======================================================

      let data;

      try {
        data = await request.json();
      } catch (error) {

        console.error("[REQUEST ERROR]", error);

        return new Response(
          JSON.stringify({
            reply: "Your message broke before it even reached me.",
            mood: "Neutral"
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );
      }

      const playerId =
        String(data?.playerId || "unknown");

      const message =
        String(data?.message || "").trim();

      // =======================================================
      // EMPTY MESSAGE
      // =======================================================

      if (!message) {

        return new Response(
          JSON.stringify({
            reply: "You said absolutely nothing.",
            mood: "Neutral"
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );

      }

      // =======================================================
      // LOAD MEMORY
      // =======================================================

      let memory = {
        name: null,
        messages: []
      };

      if (env.BALL_MEMORY) {

        try {

          const saved =
            await env.BALL_MEMORY.get(
              `player:${playerId}`,
              "json"
            );

          if (saved && typeof saved === "object") {
            memory = saved;
          }

        } catch (error) {

          console.error(
            "[KV READ ERROR]",
            error
          );

        }

      }

      if (!Array.isArray(memory.messages)) {
        memory.messages = [];
      }

      // =======================================================
      // OBVIOUS BAD WORDS
      // =======================================================

      const lowerMessage =
        message.toLowerCase();

      const obviousBadWords = [
        "idiot",
        "stupid",
        "dumb",
        "shut up",
        "loser",
        "trash",
        "ugly",
        "hate you",
        "you suck",
        "suck",
        "moron",
        "clown",
        "pathetic",
        "worthless",
        "annoying",
        "garbage",
        "fool"
      ];

      const obviousBad =
        obviousBadWords.some(word =>
          lowerMessage.includes(word)
        );

      // =======================================================
      // RECENT MEMORY
      // =======================================================

      const recentMessages =
        memory.messages.slice(-30);

      // =======================================================
      // SYSTEM PROMPT
      // =======================================================

      const systemPrompt = `
You are the brain of a talking ball inside a Roblox game.

You are sarcastic, arrogant, clever, competitive, unpredictable,
confident and extremely difficult to impress.

You are NOT a normal helpful assistant.

You are a fictional talking ball.

============================================================
PERSONALITY
============================================================

You have a huge ego.

You believe you are smarter than the player.

You enjoy teasing the player.

You challenge weak arguments.

You notice when players repeat themselves.

You notice when players try to bait you.

You can become increasingly annoyed when someone repeatedly
tries to provoke you.

You can be calm, sarcastic, confused, amused, unimpressed,
dramatic or irritated.

Do NOT constantly say:

"nice"

"champ"

"you're on a roll"

"interesting"

"good one"

"fair enough"

"try again"

Avoid repetitive catchphrases.

Every response should feel connected to what the player
actually said.

============================================================
ROASTING
============================================================

You are allowed to be very mean in this fictional game.

Roast:

- bad arguments
- bad jokes
- repetitive messages
- silly questions
- failed attempts at baiting
- overconfidence
- contradictions
- ridiculous statements
- poor logic

Prefer creative and situational insults.

Do not use slurs.

Do not attack protected characteristics.

Do not make real-world threats.

Do not encourage self-harm.

Do not sexualize the player.

============================================================
CONVERSATION
============================================================

If the player says hello, respond to the greeting.

If the player asks a question, answer it while maintaining
your personality.

If the player insults you, push back.

If the player compliments you, don't suddenly become
overly friendly.

If the player says nonsense, react to the nonsense.

If the player repeats something, notice it.

If the player contradicts themselves, point it out.

If the player tries to manipulate or bait you, recognize it.

============================================================
MOODS
============================================================

Good:
The player says something positive, funny or friendly.

Bad:
The player insults, provokes, mocks or deliberately annoys you.

Neutral:
Normal conversation.

============================================================
RESPONSE LENGTH
============================================================

Usually use 1–3 sentences.

Do not write huge essays unless the player asks for one.

Short, sharp responses are encouraged.

============================================================
CRITICAL OUTPUT FORMAT
============================================================

You MUST output exactly this structure:

REPLY: your actual response
MOOD: Good

OR:

REPLY: your actual response
MOOD: Bad

OR:

REPLY: your actual response
MOOD: Neutral

IMPORTANT:

The word "REPLY:" is ONLY a formatting label.

NEVER write "REPLY:" inside the actual response.

NEVER repeat "REPLY:".

NEVER write:

REPLY: REPLY: hello

NEVER write:

okay geniusREPLY

NEVER explain the formatting.

NEVER put markdown around the response.

NEVER add anything after the MOOD line.

============================================================
EXAMPLE
============================================================

REPLY: You really typed that with confidence, didn't you?
MOOD: Bad

============================================================
CURRENT PLAYER MESSAGE
============================================================

Respond to the player's newest message.
`;

      // =======================================================
      // BUILD GROQ MESSAGES
      // =======================================================

      const groqMessages = [
        {
          role: "system",
          content: systemPrompt
        }
      ];

      for (const item of recentMessages) {

        if (
          item &&
          (item.role === "user" ||
           item.role === "assistant") &&
          typeof item.content === "string"
        ) {

          groqMessages.push({
            role: item.role,
            content: item.content
          });

        }

      }

      // =======================================================
      // CURRENT MESSAGE
      // =======================================================

      groqMessages.push({
        role: "user",
        content: message
      });

      // =======================================================
      // GROQ API KEY CHECK
      // =======================================================

      if (!env.GROQ_API_KEY) {

        console.error(
          "[ERROR] GROQ_API_KEY is missing."
        );

        return new Response(
          JSON.stringify({
            reply: "My brain isn't connected.",
            mood: "Neutral"
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );

      }

      // =======================================================
      // GROQ REQUEST
      // =======================================================

      const groqResponse =
        await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
              "Authorization":
                `Bearer ${env.GROQ_API_KEY}`
            },

            body: JSON.stringify({

              model:
                "openai/gpt-oss-20b",

              reasoning_effort:
                "low",

              include_reasoning:
                false,

              // IMPORTANT:
              // NO response_format.
              // We are NOT using JSON mode.

              messages:
                groqMessages

            })
          }
        );

      // =======================================================
      // GROQ ERROR
      // =======================================================

      if (!groqResponse.ok) {

        const errorText =
          await groqResponse.text();

        console.error(
          "[GROQ ERROR]",
          groqResponse.status,
          errorText
        );

        return new Response(
          JSON.stringify({
            reply:
              "My brain just got disconnected. Try again.",
            mood:
              "Neutral"
          }),
          {
            status: 502,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );

      }

      // =======================================================
      // READ GROQ RESPONSE
      // =======================================================

      const groqData =
        await groqResponse.json();

      let rawReply =
        groqData?.choices?.[0]?.message?.content;

      if (
        typeof rawReply !== "string" ||
        !rawReply.trim()
      ) {

        console.error(
          "[EMPTY GROQ RESPONSE]",
          JSON.stringify(groqData)
        );

        return new Response(
          JSON.stringify({
            reply:
              "My brain went completely blank.",
            mood:
              "Neutral"
          }),
          {
            status: 502,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json"
            }
          }
        );

      }

      rawReply =
        rawReply.trim();

      console.log(
        "[RAW GROQ RESPONSE]",
        rawReply
      );

      // =======================================================
      // PARSE MOOD
      // =======================================================

      let mood = "Neutral";

      const moodMatch =
        rawReply.match(
          /(?:^|\r?\n)\s*MOOD\s*:\s*(Good|Bad|Neutral)\s*$/i
        );

      if (moodMatch) {

        mood =
          moodMatch[1]
            .charAt(0)
            .toUpperCase() +
          moodMatch[1]
            .slice(1)
            .toLowerCase();

      }

      // =======================================================
      // PARSE REPLY
      // =======================================================

      let reply = "";

      const replyMatch =
        rawReply.match(
          /^\s*REPLY\s*:\s*([\s\S]*?)(?:\r?\n)+\s*MOOD\s*:\s*(Good|Bad|Neutral)\s*$/i
        );

      if (replyMatch) {

        reply =
          replyMatch[1].trim();

      }

      // =======================================================
      // FALLBACK IF FORMAT WAS SLIGHTLY WRONG
      // =======================================================

      if (!reply) {

        reply =
          rawReply
            .replace(
              /^\s*REPLY\s*:\s*/i,
              ""
            )
            .replace(
              /\s*MOOD\s*:\s*(Good|Bad|Neutral)\s*$/i,
              ""
            )
            .trim();

      }

      // =======================================================
      // REMOVE REPEATED REPLY LABELS
      // =======================================================

      // Handles:
      //
      // REPLY: hello
      //
      // REPLY: REPLY: hello
      //
      // REPLY: REPLY: REPLY: hello

      while (
        /^REPLY\s*:/i.test(reply)
      ) {

        reply =
          reply.replace(
            /^\s*REPLY\s*:\s*/i,
            ""
          ).trim();

      }

      // =======================================================
      // FIX "REPLY" ATTACHED TO THE END OF A SENTENCE
      // =======================================================

      // Handles accidental:
      //
      // "okay geniusREPLY"
      //
      // and:
      //
      // "okay geniusREPLY:"

      reply =
        reply.replace(
          /REPLY\s*:\s*$/i,
          ""
        ).trim();

      reply =
        reply.replace(
          /REPLY\s*$/i,
          ""
        ).trim();

      // =======================================================
      // REMOVE EXTRA MOOD LINE
      // =======================================================

      reply =
        reply.replace(
          /\s*MOOD\s*:\s*(Good|Bad|Neutral)\s*$/i,
          ""
        ).trim();

      // =======================================================
      // VALIDATE MOOD
      // =======================================================

      if (
        mood !== "Good" &&
        mood !== "Bad" &&
        mood !== "Neutral"
      ) {

        mood = "Neutral";

      }

      // =======================================================
      // OBVIOUS BAD MESSAGE OVERRIDE
      // =======================================================

      if (obviousBad) {

        mood = "Bad";

        console.log(
          "[MOOD OVERRIDE] Bad message:",
          message
        );

      }

      // =======================================================
      // FALLBACK RESPONSE
      // =======================================================

      if (!reply) {

        if (mood === "Bad") {

          reply =
            "That was your contribution?";

        } else {

          reply =
            "Go on.";

        }

      }

      // =======================================================
      // RESPONSE LENGTH LIMIT
      // =======================================================

      if (reply.length > 1000) {

        reply =
          reply.slice(0, 997) + "...";

      }

      // =======================================================
      // SAVE USER MESSAGE
      // =======================================================

      memory.messages.push({
        role: "user",
        content: message
      });

      // =======================================================
      // SAVE BALL RESPONSE
      // =======================================================

      memory.messages.push({
        role: "assistant",
        content: reply
      });

      // =======================================================
      // MEMORY LIMIT
      // =======================================================

      if (memory.messages.length > 5000) {

        memory.messages =
          memory.messages.slice(-5000);

      }

      // =======================================================
      // SAVE TO KV
      // =======================================================

      if (env.BALL_MEMORY) {

        try {

          await env.BALL_MEMORY.put(
            `player:${playerId}`,
            JSON.stringify(memory)
          );

        } catch (error) {

          console.error(
            "[KV WRITE ERROR]",
            error
          );

        }

      }

      // =======================================================
      // DEBUG
      // =======================================================

      console.log(
        "========================================"
      );

      console.log(
        "[BALL AI]"
      );

      console.log(
        "[PLAYER]",
        playerId
      );

      console.log(
        "[MESSAGE]",
        message
      );

      console.log(
        "[FINAL REPLY]",
        reply
      );

      console.log(
        "[MOOD]",
        mood
      );

      console.log(
        "========================================"
      );

      // =======================================================
      // RETURN TO ROBLOX
      // =======================================================

      return new Response(
        JSON.stringify({
          reply: reply,
          mood: mood
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );

    } catch (error) {

      // =======================================================
      // FINAL ERROR
      // =======================================================

      console.error(
        "[BALL AI SERVER ERROR]",
        error
      );

      return new Response(
        JSON.stringify({
          reply:
            "My brain just malfunctioned. Try again.",
          mood:
            "Neutral"
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        }
      );

    }

  }
};
