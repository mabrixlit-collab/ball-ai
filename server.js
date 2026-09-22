export default {
  async fetch(request, env) {

    // ----------------------------------------
    // HEALTH CHECK
    // ----------------------------------------

    if (request.method === "GET") {
      return new Response("Ball AI is online!", {
        status: 200,
        headers: {
          "Content-Type": "text/plain"
        }
      });
    }

    // ----------------------------------------
    // ONLY ALLOW POST
    // ----------------------------------------

    if (request.method !== "POST") {
      return new Response("Method not allowed", {
        status: 405
      });
    }

    try {

      const data = await request.json();

      const playerId = String(data.playerId || "unknown");
      const message = String(data.message || "").trim();

      if (!message) {
        return new Response(JSON.stringify({
          reply: "You said absolutely nothing.",
          mood: "Neutral"
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }

      // ----------------------------------------
      // LOAD MEMORY
      // ----------------------------------------

      let memory = {
        name: null,
        messages: []
      };

      if (env.BALL_MEMORY) {

        const saved = await env.BALL_MEMORY.get(
          `player:${playerId}`,
          "json"
        );

        if (saved) {
          memory = saved;
        }

      }

      // ----------------------------------------
      // SAVE PLAYER MESSAGE
      // ----------------------------------------

      memory.messages.push({
        role: "user",
        content: message
      });

      // Keep long-term memory
      if (memory.messages.length > 5000) {
        memory.messages =
          memory.messages.slice(-5000);
      }

      // ----------------------------------------
      // IMPORTANT:
      // SEND ONLY RECENT MESSAGES TO THE AI
      // ----------------------------------------

      const recentMessages =
        memory.messages.slice(-25);

      // ----------------------------------------
      // OBVIOUS INSULT FALLBACK
      // ----------------------------------------
      //
      // The AI should classify these itself,
      // but this guarantees obvious insults
      // don't accidentally become Neutral.
      //

      const lowerMessage =
        message.toLowerCase().trim();

      const obviousBadWords = [
        "stupid",
        "idiot",
        "dumb",
        "moron",
        "loser",
        "ugly",
        "shut up",
        "shut the hell up",
        "trash",
        "pathetic",
        "useless",
        "annoying"
      ];

      const obviousBad =
        obviousBadWords.some(word =>
          lowerMessage.includes(word)
        );

      // ----------------------------------------
      // GROQ REQUEST
      // ----------------------------------------

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

              // --------------------------------
              // SYSTEM
              // --------------------------------

              {
                role: "system",

                content: `
You are the AI brain of a talking ball inside a Roblox game.

Your personality:
- clever
- sarcastic
- confident
- slightly disrespectful
- funny
- observant
- never cringe
- never swear
- never use slurs
- never attack protected groups
- never make threats

You must actually understand and answer what the player says.

Handle:
- normal questions
- random questions
- jokes
- slang
- typos
- short messages
- insults
- compliments
- arguments

IMPORTANT MOOD CLASSIFICATION:

You MUST classify the player's CURRENT message as exactly one of:

"Good"
"Bad"
"Neutral"

Use these rules:

GOOD:
The player is being friendly, complimentary, appreciative,
helpful, supportive, or clearly positive toward the ball.

BAD:
The player insults, mocks, belittles, ridicules, abuses,
or deliberately speaks disrespectfully toward the ball.

Examples of BAD:
"you're stupid"
"you are dumb"
"idiot"
"you're an idiot"
"you're useless"
"you're trash"
"shut up"
"you're annoying"
"what a stupid ball"
"this ball is pathetic"

NEUTRAL:
Normal questions, ordinary conversation, greetings,
statements without clear positive or negative intent,
or ambiguous messages.

IMPORTANT:
If the player directly calls the ball something insulting,
that is BAD.

For example:
"stupid" = Bad
"idiot" = Bad
"dumb ball" = Bad
"you're useless" = Bad

Do NOT classify an obvious insult as Neutral.

The reply should normally be ONE short sentence.

The reply should answer the player when they ask a genuine question.

If the player insults you, roast them back intelligently,
without swearing.

Return ONLY valid JSON in exactly this structure:

{
  "reply": "your response",
  "mood": "Good"
}

The mood MUST be exactly:
Good
Bad
or Neutral.
`
              },

              // --------------------------------
              // RECENT CONVERSATION
              // --------------------------------

              ...recentMessages

            ]

          })
        }
      );

      // ----------------------------------------
      // CHECK GROQ RESPONSE
      // ----------------------------------------

      if (!groqResponse.ok) {

        const errorText =
          await groqResponse.text();

        console.error(
          "[GROQ ERROR]",
          groqResponse.status,
          errorText
        );

        throw new Error(
          `Groq HTTP ${groqResponse.status}: ${errorText}`
        );
      }

      const groqData =
        await groqResponse.json();

      const rawReply =
        groqData?.choices?.[0]?.message?.content;

      if (!rawReply) {
        throw new Error(
          "Groq returned no message content."
        );
      }

      // ----------------------------------------
      // PARSE AI JSON
      // ----------------------------------------

      let aiResult;

      try {

        aiResult =
          JSON.parse(rawReply);

      } catch (error) {

        console.error(
          "[JSON PARSE ERROR]",
          rawReply
        );

        throw new Error(
          "AI returned invalid JSON."
        );
      }

      // ----------------------------------------
      // CLEAN RESPONSE
      // ----------------------------------------

      let reply =
        String(aiResult.reply || "").trim();

      let mood =
        String(aiResult.mood || "Neutral").trim();

      // ----------------------------------------
      // VALIDATE MOOD
      // ----------------------------------------

      if (
        mood !== "Good" &&
        mood !== "Bad" &&
        mood !== "Neutral"
      ) {
        mood = "Neutral";
      }

      // ----------------------------------------
      // OBVIOUS INSULT OVERRIDE
      // ----------------------------------------
      //
      // If the AI somehow says Neutral for
      // an extremely obvious insult, force Bad.
      //

      if (obviousBad) {
        mood = "Bad";

        console.log(
          "[MOOD OVERRIDE] Obvious insult detected:",
          message
        );
      }

      // ----------------------------------------
      // FALLBACK REPLY
      // ----------------------------------------

      if (!reply) {

        if (mood === "Bad") {

          reply =
            "That was remarkably unnecessary.";

        } else {

          reply =
            "Interesting.";
        }
      }

      // ----------------------------------------
      // SAVE AI RESPONSE
      // ----------------------------------------

      memory.messages.push({
        role: "assistant",
        content: reply
      });

      // Keep maximum 5000 stored messages
      if (memory.messages.length > 5000) {

        memory.messages =
          memory.messages.slice(-5000);

      }

      // ----------------------------------------
      // SAVE TO KV
      // ----------------------------------------

      if (env.BALL_MEMORY) {

        await env.BALL_MEMORY.put(
          `player:${playerId}`,
          JSON.stringify(memory)
        );

      }

      // ----------------------------------------
      // DEBUG LOG
      // ----------------------------------------

      console.log(
        "[BALL AI]",
        JSON.stringify({
          playerId,
          message,
          reply,
          mood
        })
      );

      // ----------------------------------------
      // SEND TO ROBLOX
      // ----------------------------------------

      return new Response(
        JSON.stringify({
          reply,
          mood
        }),
        {
          status: 200,

          headers: {
            "Content-Type": "application/json"
          }
        }
      );

    } catch (error) {

      console.error(
        "[SERVER ERROR]",
        error
      );

      return new Response(
        JSON.stringify({
          reply: "My brain just malfunctioned.",
          mood: "Neutral"
        }),
        {
          status: 500,

          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
  }
};
