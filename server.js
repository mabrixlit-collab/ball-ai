export default {
  async fetch(request, env) {

    try {

      // =========================
      // HEALTH CHECK
      // =========================
      if (request.method === "GET") {
        return new Response("Ball AI is online!");
      }


      // =========================
      // READ ROBLOX REQUEST
      // =========================
      const body = await request.json();

      const playerId = String(body.playerId || "");
      const message = String(body.message || "").trim();

      if (!playerId || !message) {
        return Response.json({
          reply: "You forgot to actually say something.",
          mood: "Neutral"
        }, { status: 400 });
      }


      // =========================
      // LOAD PLAYER MEMORY
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

      if (!memory.facts) memory.facts = [];
      if (!memory.messages) memory.messages = [];
      if (!memory.recentReplies) memory.recentReplies = [];


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
      // SAVE MESSAGE
      // =========================
      memory.messages.push({
        role: "user",
        content: message
      });

      if (memory.messages.length > 12) {
        memory.messages = memory.messages.slice(-12);
      }


      // =========================
      // MEMORY TEXT
      // =========================
      const memoryText = `
Player name:
${memory.name || "Unknown"}

Known facts:
${memory.facts.length ? memory.facts.join("\n") : "None"}

Recent conversation:
${memory.messages
  .map(m => `${m.role}: ${m.content}`)
  .join("\n")}
`;


      // =========================
      // AI REQUEST
      // =========================
      const aiResponse = await fetch(
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

Your personality:
- casual
- clever
- sarcastic
- extremely disrespectful when someone is rude
- friendly when someone is friendly
- never use profanity
- never use slurs
- never threaten anyone
- never attack protected characteristics
- never sound like a professor
- never sound like a stereotypical TikTok commenter
- never repeatedly say "genius", "bro", "nah", "fr", "you're cooked", "who let you cook", or "be serious"
- do not constantly use emojis
- do not constantly use skull emojis
- use sophisticated vocabulary occasionally, but remain casual
- usually use 1–3 slightly sophisticated words
- maximum 5 sophisticated words in a response
- answers should normally be one short sentence
- usually 6–20 words
- actually answer genuine questions instead of forcing a roast
- understand typos, slang and messy typing
- if someone asks something simple, answer it naturally
- if someone insults you, roast them back intelligently
- do not claim to have forgotten information that is explicitly in memory

IMPORTANT:
If the player asks for their name and a name is stored, use that name.

The player may ask completely new questions. Answer them normally.

Return ONLY valid JSON in exactly this structure:

{
  "reply": "your response",
  "mood": "Good"
}

Mood must be exactly one of:
Good
Bad
Neutral

GOOD:
Friendly, appreciative, positive or polite messages.

BAD:
Insults, hostility, deliberate rudeness or antagonistic messages.

NEUTRAL:
Normal questions, statements, greetings or messages that are neither clearly good nor bad.

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
      // CHECK GROQ RESPONSE
      // =========================
      if (!aiResponse.ok) {

        const errorText = await aiResponse.text();

        console.error(
          "GROQ ERROR:",
          aiResponse.status,
          errorText
        );

        return Response.json({
          reply: "My brain just malfunctioned.",
          mood: "Neutral"
        }, { status: 500 });
      }


      // =========================
      // PARSE AI RESPONSE
      // =========================
      const aiData = await aiResponse.json();

      const rawContent =
        aiData.choices?.[0]?.message?.content;

      if (!rawContent) {
        throw new Error("Groq returned no content.");
      }

      const result = JSON.parse(rawContent);


      // =========================
      // VALIDATE MOOD
      // =========================
      let mood = result.mood;

      if (
        mood !== "Good" &&
        mood !== "Bad" &&
        mood !== "Neutral"
      ) {
        mood = "Neutral";
      }

      const reply = String(
        result.reply || "I have absolutely nothing to say."
      );


      // =========================
      // SAVE AI RESPONSE
      // =========================
      memory.messages.push({
        role: "assistant",
        content: reply
      });

      if (memory.messages.length > 12) {
        memory.messages = memory.messages.slice(-12);
      }


      // =========================
      // PREVENT RECENT REPETITION
      // =========================
      memory.recentReplies.push(reply);

      if (memory.recentReplies.length > 8) {
        memory.recentReplies =
          memory.recentReplies.slice(-8);
      }


      // =========================
      // SAVE EVERYTHING TO KV
      // =========================
      await env.BALL_MEMORY.put(
        key,
        JSON.stringify(memory)
      );


      // =========================
      // SEND TO ROBLOX
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

        reply: "My brain has encountered an unfortunate inconvenience.",

        mood: "Neutral"

      }, {
        status: 500
      });

    }

  }
};
