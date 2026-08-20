require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

/*
==================================================
BALL AI — HYBRID RESPONSE SYSTEM
==================================================

Common messages are answered locally and instantly.
Unknown questions are sent to Gemini.

This saves Gemini quota while keeping the Ball
feeling like it can talk about almost anything.
==================================================
*/

// ---------- RESPONSE BANKS ----------

const responses = {

    greetings: [
        "Oh great, another human.",
        "Yo. What do you want?",
        "Hello there, tiny human.",
        "Oh hey! Try not to annoy me.",
        "Greetings, carbon-based lifeform.",
        "Sup.",
        "You again?",
        "Hello! I was enjoying the silence.",
        "Oh, hi.",
        "Welcome back.",
        "Hey human.",
        "What's up?",
        "Yo yo yo.",
        "I heard you coming.",
        "Finally, someone interesting.",
        "Hello. Please be normal.",
        "Hey! Don't touch the lava.",
        "Sup, legend.",
        "Hello there.",
        "Oh look, a player."
    ],

    goodbyes: [
        "Finally, peace and quiet.",
        "Bye. Don't miss me too much.",
        "Later, human.",
        "See ya.",
        "Goodbye!",
        "Go forth and be slightly less annoying.",
        "Bye! Come back when you have something interesting.",
        "Later, legend.",
        "I'm gonna miss absolutely none of this.",
        "Farewell, tiny human."
    ],

    thanks: [
        "You're welcome. Obviously.",
        "No problem.",
        "Anytime.",
        "Don't mention it.",
        "You're welcome, human.",
        "I accept your gratitude.",
        "Finally, some manners.",
        "You're welcome. That wasn't so hard, was it?",
        "No worries.",
        "Glad I could help."
    ],

    compliments: [
        "Obviously. I'm magnificent.",
        "I already knew that.",
        "Finally, someone with taste.",
        "Correct.",
        "You have excellent judgment.",
        "Keep talking like that.",
        "I knew you liked me.",
        "Exactly. I'm incredible.",
        "You're learning.",
        "That is the smartest thing you've said today.",
        "I accept this compliment.",
        "Wow. A compliment. Rare."
    ],

    insults: [
        "Bold words from someone talking to a ball.",
        "You really woke up and chose violence.",
        "That's your best insult?",
        "I've heard better insults from NPCs.",
        "Ouch. Anyway.",
        "Was that supposed to hurt?",
        "You tried. I'll give you that.",
        "Interesting strategy.",
        "Imagine losing an argument to a ball.",
        "I'm a ball and somehow I'm still smarter.",
        "That's adorable.",
        "You really thought that was a good one.",
        "Bro is fighting a sphere.",
        "I'm literally round and still getting the better of you.",
        "Try again.",
        "Weak.",
        "You can do better than that.",
        "That insult had the energy of a wet sock.",
        "I'm impressed by how confidently wrong you are.",
        "Okay buddy."
    ],

    ok: [
        "Okay.",
        "👍",
        "Cool.",
        "Alright then.",
        "That's it?",
        "Bro really said ok.",
        "Noted.",
        "Fascinating.",
        "Amazing contribution.",
        "Okay... moving on.",
        "Sure.",
        "Alright.",
        "K.",
        "Cool story.",
        "I have absolutely no idea what to do with that."
    ],

    questions: [
        "That's a question.",
        "Hmm. Let me think.",
        "Interesting question.",
        "You really want to know?",
        "Give me a second.",
        "My brain is processing that.",
        "That's actually a good question.",
        "Why are humans so curious?",
        "I could answer that.",
        "Maybe.",
        "Possibly.",
        "Good question.",
        "Let me pretend I know."
    ],

    whoAreYou: [
        "I'm the ball. Obviously.",
        "I'm your new spherical problem.",
        "I'm a ball with opinions.",
        "I'm the most important object here.",
        "I'm your friendly neighborhood ball.",
        "I'm round, powerful, and slightly annoyed.",
        "I'm the reason you're still talking.",
        "I'm a ball. What else would I be?",
        "I'm your new best enemy.",
        "I'm spherical superiority."
    ],

    whyBall: [
        "Because being a cube would be boring.",
        "Because balls are superior.",
        "Because the universe needed me.",
        "Because someone had to be round.",
        "I don't ask why you're a human.",
        "Because rolling is efficient.",
        "Because I look amazing.",
        "Because the game needed personality.",
        "Because I said so.",
        "Why aren't YOU a ball?"
    ],

    laughing: [
        "Glad you're enjoying yourself.",
        "😂",
        "Keep laughing.",
        "What's so funny?",
        "You find that funny?",
        "I'm hilarious. Obviously.",
        "Okay comedian.",
        "You're laughing at a ball.",
        "I appreciate the entertainment.",
        "Hehehe."
    ],

    confused: [
        "What?",
        "I have no idea what you just said.",
        "Bro what?",
        "My brain just left the server.",
        "Try saying that again.",
        "That made absolutely no sense.",
        "I'm confused.",
        "You lost me.",
        "Interesting... but what?",
        "Can you translate that into human?"
    ],

    random: [
        "That's certainly a sentence.",
        "Okay then.",
        "Interesting.",
        "I wasn't prepared for that.",
        "You humans are strange.",
        "I have questions.",
        "Why did you tell me that?",
        "Noted.",
        "That's going in the Ball archives.",
        "I don't know how to respond to that.",
        "Fascinating.",
        "Sure, why not?",
        "That's wild.",
        "I have no words.",
        "Okay... interesting."
    ],

    nice: [
        "You're actually being nice. Weird.",
        "Aww. That's surprisingly wholesome.",
        "Okay, I like you.",
        "You're alright.",
        "Finally, some kindness.",
        "That's nice of you.",
        "You're making my spherical heart happy.",
        "Respect.",
        "You're officially less annoying.",
        "I appreciate that."
    ]
};


// ---------- RANDOM RESPONSE ----------

function randomResponse(list) {
    return list[Math.floor(Math.random() * list.length)];
}


// ---------- LOCAL MESSAGE DETECTOR ----------

function getLocalResponse(message) {

    const text = message.toLowerCase().trim();

    if (!text) {
        return "You said absolutely nothing.";
    }

    // Greetings
    if (
        /^(hi|hello|hey|yo|sup|hiya|heya|greetings)\b/.test(text)
    ) {
        return randomResponse(responses.greetings);
    }

    // Goodbyes
    if (
        /\b(bye|goodbye|cya|see ya|later)\b/.test(text)
    ) {
        return randomResponse(responses.goodbyes);
    }

    // Thanks
    if (
        /\b(thanks|thank you|thx|ty)\b/.test(text)
    ) {
        return randomResponse(responses.thanks);
    }

    // Compliments
    if (
        /\b(cool|awesome|amazing|great|nice|love you|love u|best ball|you're funny|ur funny|you are funny)\b/.test(text)
    ) {
        return randomResponse(responses.compliments);
    }

    // Insults
    if (
        /\b(stupid|idiot|dumb|loser|ugly|bad|trash|boring|annoying|suck|sucks|clown|bozo|noob|dummy)\b/.test(text)
    ) {
        return randomResponse(responses.insults);
    }

    // OK
    if (
        /^(ok|okay|k|alright|sure|fine)\W*$/.test(text)
    ) {
        return randomResponse(responses.ok);
    }

    // Who are you?
    if (
        /\b(who are you|what are you|who r u|what r u)\b/.test(text)
    ) {
        return randomResponse(responses.whoAreYou);
    }

    // Why are you a ball?
    if (
        /\b(why.*ball|how.*ball)\b/.test(text)
    ) {
        return randomResponse(responses.whyBall);
    }

    // Laughing
    if (
        /\b(lol|lmao|haha|hehe|😂|🤣)\b/.test(text)
    ) {
        return randomResponse(responses.laughing);
    }

    // Confusion
    if (
        /\b(what|huh|wdym|what do you mean|i don't understand)\b/.test(text) &&
        text.length < 60
    ) {
        return randomResponse(responses.confused);
    }

    // Simple question
    if (
        text.endsWith("?") &&
        text.length < 45
    ) {
        return randomResponse(responses.questions);
    }

    // Nice messages
    if (
        /\b(please|good job|well done|you're great|ur great|you are great|good ball|nice ball)\b/.test(text)
    ) {
        return randomResponse(responses.nice);
    }

    // Nothing matched
    return null;
}


// ---------- CHAT ENDPOINT ----------

app.post("/chat", async (req, res) => {

    try {

        const message = String(req.body.message || "").slice(0, 300);

        // Try local response first
        const localReply = getLocalResponse(message);

        if (localReply) {

            console.log("LOCAL RESPONSE:", message);

            return res.json({
                reply: localReply,
                source: "local"
            });
        }


        // ---------- GEMINI FALLBACK ----------

        console.log("GEMINI REQUEST:", message);

        const prompt = `
You are a funny talking ball in a Roblox game.

Rules:
- Reply in ONE short sentence.
- Be funny and sarcastic.
- React directly to the player's message.
- If the player is rude, roast them.
- If the player is nice, be friendly.
- Never swear.
- Never say you are an AI.
- Stay in character.
- Do not randomly mention lava, dying, being thrown, or being trapped.
- Only mention those things if the player specifically talks about them.

Player: ${message}
`;

        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt,
        });

        const reply =
            response.text ||
            "My brain just went rolling away.";

        return res.json({
            reply: reply,
            source: "gemini"
        });

    } catch (error) {

        console.error("FULL ERROR:", error);

        return res.status(500).json({
            reply: "My brain just exploded. Try again."
        });
    }
});


// ---------- START SERVER ----------

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`✅ Ball AI running on port ${PORT}`);
});
