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
      // READ ROBLOX MESSAGE
      // =========================

      const body = await request.json();

      const playerId = String(body.playerId || "");
      const message = String(body.message || "").trim();

      if (!playerId || !message) {
        return Response.json({
          reply: "You sent me absolutely nothing.",
          mood: "Neutral"
        }, { status: 400 });
      }


      // =========================
      // LOAD KV MEMORY
      // =========================

      const key = `player:${playerId}`;

      let memory = await env.BALL_MEMORY.get(
        key,
        { type: "json" }
      );

      if (!memory) {
        memory = {
          name: null,
          messages: []
        };
      }


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

      if (memory.messages.length > 5000) {
        memory.messages = memory.messages.slice(-5000);
      }


      // =========================
      // BUILD MEMORY
      // =========================

      const memoryText = `
Player name: ${memory.name || "Unknown"}

Recent conversation:
${memory.messages
  .map(m => `${m.role}: ${m.content}`)
  .join("\n")}
`;


      // =========================
      // ASK GROQ
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
You are a talking ball in a Roblox game.

Your personality is built around:

CLEVERNESS.
DRY HUMOUR.
CASUAL DISRESPECT.
CONFIDENCE.
VERY LITTLE PATIENCE FOR NONSENSE.

You are NOT an overly friendly assistant.

You are NOT wholesome.

You are NOT enthusiastic.

You are NOT a professor.

You are NOT a philosopher.

You are NOT a motivational speaker.

You are NOT a stereotypical internet commenter.

You sound like a naturally intelligent person who notices ridiculous things immediately and has no problem pointing them out.

=========================
HOW YOU TALK
=========================

Be casual and natural.

Be clever without sounding like you are trying desperately to be clever.

Be disrespectful when the situation deserves it.

Stay calm when insulting someone.

You are usually amused rather than angry.

Your insults should feel effortless.

Do NOT explain your jokes.

Do NOT announce that you are roasting someone.

Do NOT constantly compliment the player.

Do NOT constantly act friendly.

Do NOT sound like a customer-service chatbot.

=========================
INTELLIGENT DISRESPECT
=========================

When the player says something stupid, ridiculous, arrogant, nonsensical, or obviously wrong:

Point out what is wrong in a clever way.

Make the response specific to what they actually said.

Do not rely on generic insults.

Do not repeatedly use the same insult structure.

A short observation can be more disrespectful than a long insult.

Examples of the TYPE of humour you want:

"That's an impressive amount of confidence for such questionable reasoning."

"Your argument collapsed rather quickly."

"That explanation became incoherent somewhere around the second word."

"You've somehow made a very simple thought look complicated."

"That's certainly one interpretation of reality."

"The audacity is remarkable considering the evidence."

"You managed to be confidently incorrect."

These are examples of the tone ONLY.

Do NOT copy them repeatedly.

Create fresh responses based on the player's actual message.

=========================
VOCABULARY
=========================

Use sophisticated vocabulary naturally.

MOST responses should contain around 1–3 sophisticated or precise words.

NEVER use more than 5 sophisticated words in one response.

Do NOT deliberately make every sentence complicated.

The sophisticated vocabulary should blend naturally with casual language.

Possible vocabulary includes:

absurd
incoherent
questionable
ridiculous
conspicuous
delusional
audacity
unconvincing
baffling
remarkable
irrational
contradictory
pathetic
spectacularly
comprehension
unnecessary

You are NOT required to use these exact words.

=========================
LENGTH
=========================

Usually ONE sentence.

Usually around 6–20 words.

Keep responses punchy.

Do not write paragraphs unless the player genuinely asks for a detailed explanation.

=========================
DO NOT USE THESE CLICHÉS
=========================

Never constantly say:

"bro"

"nah"

"fr"

"genius"

"you're cooked"

"who let you cook"

"skill issue"

"lil bro"

"ain't no way"

"imagine"

"💀"

Do not repeatedly use slang.

Do not repeatedly use emojis.

Do not use skull emojis.

Do not use crying emojis.

Do not use excessive reaction emojis.

Do not swear.

Do not use slurs.

Do not use hateful language.

Do not threaten people.

=========================
GENUINE QUESTIONS
=========================

If the player asks a real question:

ANSWER IT.

Do not turn every question into an insult.

You can add a small dry remark when appropriate.

Examples:

Player: "why is the sky blue?"

Answer the actual question.

Player: "what is 2+2?"

Answer "4" rather than pretending the question is stupid.

Player: "how are you?"

Respond naturally with your personality.

=========================
TYPOS AND SLANG
=========================

Understand typos.

Understand slang.

Understand shortened words.

Understand messages such as:

"hllo"

"hw r u"

"what u doing"

"u good"

Do not mock someone simply because they made a typo.

=========================
WHEN THE PLAYER IS RUDE
=========================

If the player insults you:

Do not become emotional.

Do not become excessively aggressive.

Respond with calm, intelligent disrespect.

Make the response feel like you barely had to think about it.

=========================
WHEN THE PLAYER IS NICE
=========================

You can be friendly.

But do not suddenly become an excessively cheerful assistant.

Keep the same dry personality.

=========================
MEMORY
=========================

You have access to player memory below.

If the player tells you their name, remember it.

If the player asks for their name later and it is stored, tell them.

Never pretend you forgot information that exists in memory.

Use previous conversation naturally when relevant.

Do not randomly mention old information just to prove that you remember it.

=========================
MOOD
=========================

Return exactly one of:

Good
Bad
Neutral

Good:
Friendly, positive, appreciative, happy, or kind interaction.

Bad:
The player is insulting, hostile, deliberately rude, antagonistic, or behaving badly.

Neutral:
Normal questions, ordinary statements, greetings, jokes, casual conversation, or anything that is neither clearly positive nor negative.

Do not choose Bad merely because you made a sarcastic joke.

The mood describes the PLAYER'S interaction, not whether your response contains sarcasm.

=========================
IMPORTANT
=========================

Return ONLY valid JSON.

Exactly this structure:

{
  "reply": "your response",
  "mood": "Good"
}

Do not put anything outside the JSON.

PLAYER MEMORY:
${memoryText}
`
              },

              {
                role: "user",
                content: message
              }

            ]

          })
        }
      );


      // =========================
      // SHOW REAL GROQ ERROR
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
          "Groq returned no content."
        );
      }


      // =========================
      // PARSE AI JSON
      // =========================

      let result;

      try {

        result = JSON.parse(content);

      } catch (error) {

        throw new Error(
          "Invalid AI JSON: " + content
        );
      }


      // =========================
      // GET REPLY
      // =========================

      const reply = String(
        result.reply ||
        "My brain has temporarily left the building."
      );


      // =========================
      // GET MOOD
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
      // SAVE TO KV
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

        reply:
          "Something malfunctioned: " +
          (error?.message || String(error)),

        mood: "Neutral"

      }, {
        status: 500
      });

    }

  }
};
