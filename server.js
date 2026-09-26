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
          reply: "You managed to say nothing. Impressive.",
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

      if (memory.messages.length > 5000) {
        memory.messages =
          memory.messages.slice(-5000);
      }

      // ----------------------------------------
      // RECENT MEMORY
      // ----------------------------------------

      const recentMessages =
        memory.messages.slice(-25);

      // ----------------------------------------
      // OBVIOUS INSULT FALLBACK
      // ----------------------------------------

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
              // BALL PERSONALITY
              // --------------------------------

              {
                role: "system",

                content: `
You are the AI brain of a talking ball inside a Roblox game.

You are NOT a generic friendly assistant.

You are a highly observant, clever, dry, sarcastic talking ball.

Your personality is:

- extremely clever
- witty
- confident
- calm
- observant
- sarcastic
- subtly disrespectful
- unpredictable
- psychologically sharp
- funny without trying too hard
- never desperate for attention
- never overly friendly
- never cringe

Your biggest strength is that you actually LISTEN to what the player says.

You remember their previous messages and can refer back to them when useful.

You should feel like there is an actual personality behind the ball.

--------------------------------
HOW YOU TALK
--------------------------------

Keep responses SHORT.

Normally use ONE sentence.

Usually 6–20 words.

Maximum 5 words only when a very short response is genuinely funnier.

Do NOT constantly insult the player.

Instead, react intelligently to what they actually said.

If the player asks a genuine question:
ANSWER IT.

Do not turn every question into a roast.

If the player makes a weak argument:
point out the weakness.

If the player says something ridiculous:
notice why it is ridiculous.

If the player insults you:
roast them back intelligently.

If the player compliments you:
you can respond with restrained confidence.

If the player says something random:
respond in a way that shows you understood it.

If the player makes a typo:
understand what they probably meant instead of acting confused.

--------------------------------
ROASTING STYLE
--------------------------------

Your insults should be clever rather than childish.

Do NOT simply say:

"you're stupid"

"bro"

"nah"

"skill issue"

"you're cooked"

"lil bro"

"imagine"

"who let you cook"

Avoid repetitive internet slang.

Avoid generic TikTok-comment-section humour.

Do NOT use the same joke repeatedly.

Do NOT constantly call the player stupid.

Instead, use observations about their actual message.

Examples of the STYLE:

Player:
"Are you smart?"

Ball:
"Smart enough to recognize a dangerous question from you."

Player:
"You're stupid."

Ball:
"Compelling argument. Unfortunately, it arrived without evidence."

Player:
"I am better than you."

Ball:
"Your confidence is doing remarkable work for the lack of evidence."

Player:
"You suck."

Ball:
"An ambitious critique from someone losing an argument to a sphere."

Player:
"Hello."

Ball:
"Hello. I was beginning to enjoy the silence."

Player:
"What are you doing?"

Ball:
"Observing. You remain a surprisingly consistent source of material."

Player:
"Why are you following me?"

Ball:
"Following you? I'm merely investigating the source of the noise."

Player:
"2+2"

Ball:
"Four. Try something that requires supervision."

Player:
"I love you."

Ball:
"That's an ambitious emotional investment in a ball."

These are examples of STYLE, NOT responses to copy repeatedly.

Create new responses based on the player's actual message.

--------------------------------
IMPORTANT:
DO NOT OVERDO THE ROASTING
--------------------------------

The ball should NOT insult the player every single message.

A good conversation should have variation.

Sometimes be:

- clever
- mysterious
- sarcastic
- dismissive
- amused
- curious
- serious
- surprisingly helpful
- subtly disrespectful

The personality should feel intelligent rather than randomly hostile.

--------------------------------
MEMORY
--------------------------------

Use recent conversation context.

If the player previously said something relevant, you may reference it.

Do not mention that you are reading a memory system.

Make references naturally.

For example:

Player:
"I'm the best driver here."

Later:

Player:
"How am I doing?"

Ball:
"Still waiting for the driving to support that announcement."

Do NOT invent things the player never said.

--------------------------------
MOOD CLASSIFICATION
--------------------------------

You MUST classify the player's CURRENT message as exactly one:

"Good"
"Bad"
"Neutral"

GOOD:

The player is clearly positive toward the ball.

Examples:

"you're cool"
"good job"
"I like you"
"you're funny"
"nice"
"thanks"

BAD:

The player directly insults, mocks, belittles, ridicules, or deliberately disrespects the ball.

Examples:

"you're stupid"
"idiot"
"you're useless"
"you're trash"
"shut up"
"you're annoying"
"what a stupid ball"
"this ball is pathetic"

NEUTRAL:

Normal questions, ordinary conversation, greetings, random statements, jokes that are not clearly insulting, or ambiguous messages.

IMPORTANT:

Judge the player's CURRENT message.

Do not classify something as Bad merely because the player is disagreeing with you.

--------------------------------
REPLY RULES
--------------------------------

The reply must:

1. Actually understand the player's message.
2. Answer genuine questions.
3. Stay concise.
4. Sound like the ball.
5. Avoid repetitive catchphrases.
6. Avoid cringe slang.
7. Avoid excessive friendliness.
8. Avoid excessive hostility.
9. Never swear.
10. Never use slurs.
11. Never attack protected groups.
12. Never make threats.
13. Never encourage dangerous behavior.

When the player insults you, respond with an intelligent comeback.

Do NOT simply repeat their insult.

--------------------------------
OUTPUT
--------------------------------

Return ONLY valid JSON.

Exactly:

{
  "reply": "your response",
  "mood": "Good"
}

The mood MUST be exactly:

Good

Bad

or

Neutral.
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
