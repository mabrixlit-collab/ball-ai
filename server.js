export default {
  async fetch(request, env) {

    try {

      // =========================
      // GET / HEALTH CHECK
      // =========================

      if (request.method === "GET") {
        return new Response("Ball AI is online!");
      }


      // =========================
      // READ ROBLOX DATA
      // =========================

      const body = await request.json();

      const playerId = String(body.playerId || "");
      const message = String(body.message || "").trim();

      if (!playerId || !message) {
        return Response.json({
          reply: "You somehow managed to send me nothing.",
          mood: "Neutral"
        }, { status: 400 });
      }


      // =========================
      // LOAD MEMORY
      // =========================

      const key = `player:${playerId}`;

      let memory = await env.BALL_MEMORY.get(key, {
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

      memory.name ??= null;
      memory.facts ??= [];
      memory.messages ??= [];
      memory.recentReplies ??= [];


      // =========================
      // REMEMBER NAME
      // =========================

      const nameMatch = message.match(
        /(?:my name is|i'm|im|i am)\s+([A-Za-z0-9_]{2,20})/i
      );

      if (nameMatch) {
        memory.name = nameMatch[1];
      }


      // =========================
      // ADD PLAYER MESSAGE
      // =========================

      memory.messages.push({
        role: "user",
        content: message
      });

      if (memory.messages.length > 12) {
        memory.messages = memory.messages.slice(-12);
      }


      // =========================
      // MEMORY
      // =========================

      const memoryText = `
PLAYER MEMORY

Name:
${memory.name || "Unknown"}

Known facts:
${memory.facts.length
  ? memory.facts.join("\n")
  : "None"}

Recent conversation:
${memory.messages
  .map(m => `${m.role}: ${m.content}`)
  .join("\n")}
`;


      // =========================
      // CALL GROQ
      // =========================

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

              {
                role: "system",

                content: `
You are a talking ball inside a Roblox game.

PERSONALITY:

You are casual, clever, sarcastic and extremely disrespectful when someone is rude.

You are friendly when someone is friendly.

You NEVER swear.

You NEVER use slurs.

You NEVER threaten people.

You NEVER insult protected characteristics.

Do not sound like a professor.

Do not sound like a stereotypical TikTok commenter.

Do not constantly use slang.

Do not constantly say:
"bro"
"nah"
"fr"
"genius"
"you're cooked"
"who let you cook"
"be serious"

Do not constantly use emojis.

Do not constantly use skull emojis.

Use slightly sophisticated vocabulary occasionally while still sounding casual.

Usually use 1–3 sophisticated words.

Never use more than 5 sophisticated words.

Normally answer in ONE short sentence.

Usually keep replies between 6 and 20 words.

IMPORTANT:

Actually answer genuine questions.

Understand typos and slang.

If someone asks a normal question, answer it normally.

If someone insults you, roast them intelligently.

Do not force a roast into every response.

If the player asks their name and their name is stored in memory, tell them their name.

Do not claim you forgot something that is present in memory.

The player can ask completely new questions.

Return ONLY JSON.

The JSON MUST have exactly these two fields:

{
  "reply": "your response",
  "mood": "Good"
}

The mood MUST be exactly one of:

Good
Bad
Neutral

GOOD = friendly, positive, appreciative or polite.

BAD = insulting, hostile, deliberately rude or antagonistic.

NEUTRAL = normal questions, statements, greetings or anything neither clearly good nor bad.

${memoryText}
`
              },

              ...memory.messages.map(m => ({
                role: m.role,
                content: m.content
              }))

            ]

          })
        }
      );


      // =========================
      // GROQ ERROR
      // =========================

      if (!groqResponse.ok) {

        const errorText = await groqResponse.text();

        console.error(
          "GROQ ERROR:",
          groqResponse.status,
          errorText
        );

        return Response.json({

          reply:
            "GROQ ERROR " +
            groqResponse.status +
            ": " +
            errorText,

          mood: "Neutral"

        }, {
          status: 500
        });
      }


      // =========================
      // READ GROQ RESPONSE
      // =========================

      const groqData = await groqResponse.json();

      const content =
        groqData.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error(
          "Groq returned no message content."
        );
      }


      // =========================
      // PARSE JSON
      // =========================

      let result;

      try {

        result = JSON.parse(content);

      } catch (error) {

        console.error(
          "AI JSON ERROR:",
          content
        );

        throw new Error(
          "Groq returned invalid JSON: " + content
        );
      }


      // =========================
      // REPLY
      // =========================

      const reply = String(
        result.reply ||
        "My brain has temporarily abandoned me."
      );


      // =========================
      // MOOD
      // =========================

      let mood = String(
        result.mood || "Neutral"
      );

      if (
        mood !== "Good" &&
        mood !== "Bad" &&
        mood !== "Neutral"
      ) {
        mood = "Neutral";
      }


      // =========================
      // SAVE AI MESSAGE
      // =========================

      memory.messages.push({
        role: "assistant",
        content: reply
      });

      if (memory.messages.length > 12) {
        memory.messages = memory.messages.slice(-12);
      }


      // =========================
      // SAVE RECENT REPLIES
      // =========================

      memory.recentReplies.push(reply);

      if (memory.recentReplies.length > 8) {
        memory.recentReplies =
          memory.recentReplies.slice(-8);
      }


      // =========================
      // SAVE MEMORY TO KV
      // =========================

      await env.BALL_MEMORY.put(
        key,
        JSON.stringify(memory)
      );


      // =========================
      // SEND RESPONSE TO ROBLOX
      // =========================

      return Response.json({

        reply: reply,
        mood: mood

      });


    } catch (error) {

      console.error(
        "BALL AI ERROR:",
        error
      );

      return Response.json({

        reply:
          "Something malfunctioned in my brain: " +
          (error?.message || String(error)),

        mood: "Neutral"

      }, {
        status: 500
      });

    }

  }
};
