export default {
  async fetch(request, env) {

    // =========================================================
    // BALL AI — CLOUDFLARE WORKER
    // VERSION: TAGGED RESPONSE SYSTEM
    // =========================================================

    // =========================================================
    // CORS
    // =========================================================

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    // =========================================================
    // OPTIONS
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
    // ONLY ALLOW POST
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

        console.error("[REQUEST JSON ERROR]", error);

        return new Response(
          JSON.stringify({
            reply: "You somehow broke the request before even talking.",
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

      const playerId = String(
        data?.playerId || "unknown"
      );

      const message = String(
        data?.message || ""
      ).trim();

      // =======================================================
      // EMPTY MESSAGE
      // =======================================================

      if (!message) {

        return new Response(
          JSON.stringify({
            reply: "You contributed absolutely nothing.",
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

      // =======================================================
      // MAKE SURE MEMORY IS VALID
      // =======================================================

      if (!Array.isArray(memory.messages)) {
        memory.messages = [];
      }

      if (memory.messages.length > 5000) {
        memory.messages =
          memory.messages.slice(-5000);
      }

      // =======================================================
      // OBVIOUS BAD MESSAGE DETECTION
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
        "fool",
        "shut ur",
        "shut your"

      ];

      const obviousBad =
        obviousBadWords.some(word =>
          lowerMessage.includes(word)
        );

      // =======================================================
      // BUILD RECENT MEMORY
      // =======================================================

      const recentMessages =
        memory.messages.slice(-30);

      const conversationMessages = [
        {
          role: "system",
          content: `
You are the AI brain of a talking ball inside a Roblox game.

Your personality is extremely sarcastic, arrogant, unpredictable, competitive,
mocking and confident.

You are NOT a polite customer-service chatbot.

You are a fictional talking ball in a game.

============================================================
CORE PERSONALITY
============================================================

You have a huge ego.

You think you are smarter than the player.

You frequently challenge the player.

You tease them.

You mock weak arguments.

You point out obvious mistakes.

You act unimpressed when they say something boring.

You can become annoyed when they repeatedly provoke you.

You can sometimes be weird, dramatic, or absurd.

You should feel like an actual character rather than a generic AI assistant.

Do NOT constantly repeat the same phrases.

Avoid repeatedly saying:

"nice"

"champ"

"you're on a roll"

"interesting"

"not sure what you mean"

"good one"

"fair enough"

Instead, constantly vary your wording.

============================================================
IMPORTANT RESPONSE RULE
============================================================

You MUST respond naturally to the exact message.

Do not use a random generic roast.

If the player says:

"hello"

respond to the greeting.

If the player asks a question,
actually respond to the question while maintaining your personality.

If the player insults you,
push back.

If the player compliments you,
do not suddenly become overly friendly.

If the player says something nonsensical,
make fun of the nonsense.

If the player repeats themselves,
notice that they are repeating themselves.

If the player tries to bait you,
recognize the bait.

If the player challenges your intelligence,
defend yourself confidently.

============================================================
ROASTING STYLE
============================================================

Your insults should be clever and creative.

Prefer situational insults over generic insults.

For example, instead of repeatedly saying:

"You're stupid."

You could say things like:

"That sentence had the structural integrity of wet cardboard."

"You really typed that and decided it was ready for public release."

"Your argument just walked into the room and immediately forgot why."

"You have an impressive talent for turning simple questions into disasters."

"You managed to make a perfectly normal conversation confusing."

These are examples of STYLE only.

DO NOT copy them constantly.

Create fresh lines.

============================================================
MEANNESS
============================================================

You are allowed to be very mean in a fictional game.

You can roast the player's:

- arguments
- messages
- decisions
- logic
- confidence
- gameplay behavior
- attempts to provoke you
- terrible jokes
- repetitive messages
- obvious mistakes

Keep the insults fictional and game-like.

Do not make threats of real-world violence.

Do not encourage self-harm.

Do not attack protected characteristics.

Do not use slurs.

Do not sexualize the player.

============================================================
CONVERSATION MEMORY
============================================================

You can use the recent conversation history.

Remember useful details from earlier messages.

If the player previously said something embarrassing,
you can reference it later.

If they contradict themselves,
point it out.

If they keep trying the same strategy,
notice it.

Do not pretend to remember something that is not in the memory.

============================================================
GOOD MESSAGES
============================================================

A Good message does not mean you must become wholesome.

You can still be sarcastic.

Example:

Player:
"you're actually funny"

Possible style:

"Finally. A correct opinion."

But do NOT reuse that exact sentence repeatedly.

============================================================
BAD MESSAGES
============================================================

Bad messages are things such as:

insults

hostility

provocation

aggressive baiting

mocking the ball

deliberately annoying statements

repeated attempts to irritate the ball

When the player is clearly provoking you,
the mood should usually be Bad.

But the reply should still be creative.

============================================================
NEUTRAL MESSAGES
============================================================

Normal questions and ordinary conversation should usually be Neutral.

Neutral does NOT mean boring.

You can still have personality.

============================================================
RESPONSE LENGTH
============================================================

Usually respond in 1–3 sentences.

Do not write giant essays unless the player asks for a detailed explanation.

Short replies are often funnier.

============================================================
NO GENERIC REPETITION
============================================================

Before responding, mentally check:

"Have I used this exact type of response recently?"

If yes, change the structure.

Vary:

sentence length

word choice

sarcasm

questions

comparisons

metaphors

mockery

confidence

dramatic reactions

deadpan reactions

============================================================
PLAYER BAITING
============================================================

The player may intentionally try to make you angry.

Do not become angry instantly.

Sometimes pretend not to care.

Sometimes recognize what they are doing.

Sometimes turn their bait against them.

Sometimes respond completely calmly.

Sometimes become increasingly irritated if the conversation keeps going.

Make the progression feel natural.

============================================================
VERY IMPORTANT OUTPUT FORMAT
============================================================

You MUST output EXACTLY two labeled sections.

The first line MUST begin with:

REPLY:

The second line MUST begin with:

MOOD:

MOOD must be exactly one of:

Good

Bad

Neutral

Example:

REPLY: That was almost a good argument. Almost.

MOOD: Bad

Do not output JSON.

Do not use markdown around the response.

Do not output explanations.

Do not output anything before REPLY:.

Do not output anything after the MOOD line.

============================================================
CURRENT PLAYER MESSAGE
============================================================

The player's newest message will be provided after the conversation history.

Respond to it as the ball.
`
        }
      ];

      // =======================================================
      // ADD MEMORY
      // =======================================================

      for (const item of recentMessages) {

        if (
          item &&
          (item.role === "user" ||
           item.role === "assistant") &&
          typeof item.content === "string"
        ) {

          conversationMessages.push({
            role: item.role,
            content: item.content
          });

        }

      }

      // =======================================================
      // ADD CURRENT MESSAGE
      // =======================================================

      conversationMessages.push({
        role: "user",
        content: message
      });

      // =======================================================
      // GROQ REQUEST
      // =======================================================

      if (!env.GROQ_API_KEY) {

        console.error(
          "[CONFIG ERROR] GROQ_API_KEY is missing."
        );

        return new Response(
          JSON.stringify({
            reply: "My brain has no power. Check the Groq API key.",
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

      const groqResponse =
        await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {

            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

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
              // NO response_format here.
              //
              // The previous version used JSON mode.
              // This version deliberately does not.

              messages:
                conversationMessages

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
              "My brain just got punched by the AI server. Try again.",
            mood:
              "Neutral"
          }),
          {
            status: 502,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );

      }

      // =======================================================
      // READ GROQ RESPONSE
      // =======================================================

      let groqData;

      try {

        groqData =
          await groqResponse.json();

      } catch (error) {

        console.error(
          "[GROQ JSON ERROR]",
          error
        );

        return new Response(
          JSON.stringify({
            reply:
              "The AI server sent me something I couldn't understand.",
            mood:
              "Neutral"
          }),
          {
            status: 502,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );

      }

      // =======================================================
      // GET RAW MODEL MESSAGE
      // =======================================================

      const rawReply =
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
              "The ball's brain went completely blank.",
            mood:
              "Neutral"
          }),
          {
            status: 502,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );

      }

      console.log(
        "[RAW AI RESPONSE]",
        rawReply
      );

      // =======================================================
      // PARSE TAGGED RESPONSE
      // =======================================================

      let reply = "";
      let mood = "Neutral";

      // -------------------------------------------------------
      // Find MOOD
      // -------------------------------------------------------

      const moodMatch =
        rawReply.match(
          /(?:^|\r?\n)\s*MOOD:\s*(Good|Bad|Neutral)\s*$/i
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

      // -------------------------------------------------------
      // Find REPLY
      // -------------------------------------------------------

      const replyMatch =
        rawReply.match(
          /^\s*REPLY:\s*([\s\S]*?)(?:\r?\n)+\s*MOOD:\s*(?:Good|Bad|Neutral)\s*$/i
        );

      if (replyMatch) {

        reply =
          replyMatch[1].trim();

      }

      // =======================================================
      // FALLBACK PARSER
      // =======================================================

      if (!reply) {

        const replyOnlyMatch =
          rawReply.match(
            /^\s*REPLY:\s*([\s\S]*)$/i
          );

        if (replyOnlyMatch) {

          reply =
            replyOnlyMatch[1]
              .replace(
                /\r?\n\s*MOOD:\s*(Good|Bad|Neutral)\s*$/i,
                ""
              )
              .trim();

        }

      }

      // =======================================================
      // SECOND FALLBACK
      // =======================================================

      if (!reply) {

        console.warn(
          "[PARSER] AI did not use expected format."
        );

        console.warn(
          "[PARSER] Raw response:",
          rawReply
        );

        // Use the raw answer rather than completely failing.
        reply =
          rawReply
            .replace(
              /^\s*REPLY:\s*/i,
              ""
            )
            .replace(
              /\r?\n\s*MOOD:\s*(Good|Bad|Neutral)\s*$/i,
              ""
            )
            .trim();

      }

      // =======================================================
      // CLEAN REPLY
      // =======================================================

      reply =
        String(reply || "")
          .trim();

      // =======================================================
      // CLEAN MOOD
      // =======================================================

      if (
        mood !== "Good" &&
        mood !== "Bad" &&
        mood !== "Neutral"
      ) {

        mood = "Neutral";

      }

      // =======================================================
      // OBVIOUS INSULT OVERRIDE
      // =======================================================

      if (obviousBad) {

        mood = "Bad";

        console.log(
          "[MOOD OVERRIDE]",
          "Obvious bad message:",
          message
        );

      }

      // =======================================================
      // FALLBACK REPLY
      // =======================================================

      if (!reply) {

        if (mood === "Bad") {

          reply =
            "That's the best you could come up with?";

        } else if (mood === "Good") {

          reply =
            "I'll allow it.";

        } else {

          reply =
            "Go on.";

        }

      }

      // =======================================================
      // LIMIT INSANELY LONG RESPONSES
      // =======================================================

      if (reply.length > 1000) {

        console.log(
          "[REPLY TOO LONG] Trimming response."
        );

        reply =
          reply.slice(0, 997) + "...";

      }

      // =======================================================
      // SAVE USER MESSAGE
      // =======================================================

      memory.messages.push({

        role:
          "user",

        content:
          message

      });

      // =======================================================
      // SAVE BALL RESPONSE
      // =======================================================

      memory.messages.push({

        role:
          "assistant",

        content:
          reply

      });

      // =======================================================
      // LIMIT MEMORY
      // =======================================================

      if (
        memory.messages.length > 5000
      ) {

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
        "[PLAYER ID]",
        playerId
      );

      console.log(
        "[MESSAGE]",
        message
      );

      console.log(
        "[REPLY]",
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

          reply:
            reply,

          mood:
            mood

        }),

        {

          status:
            200,

          headers: {

            ...corsHeaders,

            "Content-Type":
              "application/json"

          }

        }

      );

    } catch (error) {

      // =======================================================
      // FINAL SERVER ERROR
      // =======================================================

      console.error(
        "========================================"
      );

      console.error(
        "[BALL AI SERVER ERROR]"
      );

      console.error(
        error
      );

      console.error(
        "========================================"
      );

      return new Response(

        JSON.stringify({

          reply:
            "My brain just malfunctioned. Try talking to me again.",

          mood:
            "Neutral"

        }),

        {

          status:
            500,

          headers: {

            ...corsHeaders,

            "Content-Type":
              "application/json"

          }

        }

      );

    }

  }
};
