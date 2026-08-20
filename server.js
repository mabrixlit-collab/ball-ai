require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

// =====================================================
// BALL AI — SMART HYBRID SYSTEM
// =====================================================

// ---------- RANDOM ----------

function random(list) {
    return list[Math.floor(Math.random() * list.length)];
}

// ---------- LOCAL RESPONSES ----------

const replies = {

    greeting: [
        "Oh hey, another human.",
        "Yo. What's up?",
        "Hello there.",
        "Oh, it's you.",
        "Sup.",
        "Hey! Try not to annoy me.",
        "Greetings, human.",
        "Yo yo yo.",
        "Hello! I was enjoying the silence.",
        "Hey."
    ],

    howAreYou: [
        "I'm doing great. Obviously.",
        "I'm fantastic. How about you?",
        "Pretty good for a ball.",
        "I'm doing alright.",
        "Better now that you're here.",
        "I'm perfectly spherical.",
        "I'm good. You?",
        "Living the ball life.",
        "I'm doing surprisingly well.",
        "Could be worse."
    ],

    whatDoing: [
        "Talking to you, apparently.",
        "Waiting for something interesting to happen.",
        "Existing.",
        "Rolling around mentally.",
        "Thinking about important ball stuff.",
        "Nothing much.",
        "Being a ball.",
        "Waiting for your next question.",
        "Just chilling.",
        "Trying not to lose my mind."
    ],

    thanks: [
        "You're welcome.",
        "No problem.",
        "Anytime.",
        "Don't mention it.",
        "You're welcome, human.",
        "Finally, some manners.",
        "Glad I could help.",
        "No worries."
    ],

    compliment: [
        "Obviously. I'm amazing.",
        "Finally, someone with taste.",
        "I already knew that.",
        "Correct.",
        "You have excellent judgment.",
        "Keep talking like that.",
        "I accept your compliment.",
        "You're learning."
    ],

    insult: [
        "Bold words from someone talking to a ball.",
        "That's your best insult?",
        "You really thought that was good.",
        "I've heard better insults from NPCs.",
        "You tried. I'll give you that.",
        "Imagine losing an argument to a ball.",
        "I'm literally a ball and I'm still winning.",
        "Weak.",
        "Try again.",
        "That's adorable.",
        "Bro is fighting a sphere.",
        "You really woke up and chose violence."
    ],

    ok: [
        "Okay.",
        "Cool.",
        "Alright then.",
        "Noted.",
        "That's it?",
        "Bro really said ok.",
        "Sure.",
        "Alright.",
        "K.",
        "Amazing contribution."
    ],

    confused: [
        "What?",
        "Bro what?",
        "I have no idea what you just said.",
        "Try saying that again.",
        "You lost me.",
        "My brain just rolled away.",
        "That made absolutely no sense.",
        "Can you translate that into human?"
    ],

    goodbye: [
        "Bye.",
        "Later, human.",
        "See ya.",
        "Finally, peace and quiet.",
        "Goodbye.",
        "Later, legend.",
        "Come back when you have something interesting.",
        "Farewell."
    ],

    whoAmI: [
        "I'm the ball. Obviously.",
        "I'm a talking ball with opinions.",
        "I'm your spherical problem.",
        "I'm the most important object here.",
        "I'm a ball. What else would I be?",
        "I'm spherical superiority."
    ],

    whyBall: [
        "Because balls are superior.",
        "Because being a cube would be boring.",
        "Because someone had to be round.",
        "Because I said so.",
        "Because I look amazing.",
        "Why aren't YOU a ball?"
    ],

    laughing: [
        "What's so funny?",
        "Glad you're enjoying yourself.",
        "😂",
        "Keep laughing.",
        "Okay comedian.",
        "I'm hilarious. Obviously.",
        "You're laughing at a ball."
    ],

    nice: [
        "You're actually being nice. Weird.",
        "Aww. That's surprisingly wholesome.",
        "Okay, I like you.",
        "You're alright.",
        "Finally, some kindness.",
        "Respect.",
        "You're officially less annoying."
    ]
};

// =====================================================
// TEXT NORMALIZER
// =====================================================

function normalize(text) {

    let t = text
        .toLowerCase()
        .trim();

    // Remove repeated letters:
    // heyyyy -> hey
    // goooood -> good
    t = t.replace(/(.)\1{2,}/g, "$1$1");

    // Common texting/slang
    const replacements = {
        "u": "you",
        "ur": "your",
        "r": "are",
        "ya": "you",
        "yr": "your",
        "y": "why",
        "wut": "what",
        "wat": "what",
        "wht": "what",
        "hw": "how",
        "hru": "how are you",
        "wyd": "what are you doing",
        "wbu": "what about you",
        "idk": "i don't know",
        "imo": "in my opinion",
        "tbh": "to be honest",
        "thx": "thanks",
        "thanx": "thanks",
        "ty": "thank you",
        "pls": "please",
        "plz": "please",
        "bc": "because",
        "cuz": "because",
        "coz": "because",
        "bro": "bro",
        "bruh": "bro",
        "lol": "lol",
        "lmao": "lmao",
        "omg": "oh my god"
    };

    // Replace whole words
    for (const [short, full] of Object.entries(replacements)) {
        const regex = new RegExp(`\\b${short}\\b`, "g");
        t = t.replace(regex, full);
    }

    // Common typo corrections
    const typoFixes = [
        [/\bhelo\b/g, "hello"],
        [/\bhelllo\b/g, "hello"],
        [/\bheelo\b/g, "hello"],
        [/\bhallo\b/g, "hello"],

        [/\bthnks\b/g, "thanks"],
        [/\bthaks\b/g, "thanks"],
        [/\btnx\b/g, "thanks"],

        [/\bgoodd\b/g, "good"],
        [/\bgoood\b/g, "good"],

        [/\bwhats\b/g, "what is"],
        [/\bwat\b/g, "what"],
        [/\bwht\b/g, "what"],

        [/\byouu\b/g, "you"],
        [/\byuo\b/g, "you"],

        [/\bdooin\b/g, "doing"],
        [/\bdoin\b/g, "doing"],
        [/\bdoingg\b/g, "doing"],

        [/\bwhyy\b/g, "why"],
        [/\bhoww\b/g, "how"],

        [/\bpls\b/g, "please"],
        [/\bpleas\b/g, "please"]
    ];

    for (const [pattern, replacement] of typoFixes) {
        t = t.replace(pattern, replacement);
    }

    return t;
}

// =====================================================
// LOCAL RESPONSE DETECTOR
// =====================================================

function getLocalResponse(originalMessage) {

    const text = normalize(originalMessage);

    if (!text) {
        return "You said absolutely nothing.";
    }

    // -----------------------------------------------
    // GREETINGS
    // -----------------------------------------------

    if (
        /^(hi|hello|hey|yo|sup|hiya|heya|greetings)\b/.test(text)
    ) {
        return random(replies.greeting);
    }

    // -----------------------------------------------
    // HOW ARE YOU
    // -----------------------------------------------

    if (
        /\bhow are you\b/.test(text) ||
        /\bhow are you doing\b/.test(text) ||
        /\bhow r you\b/.test(text) ||
        /\bhow you doing\b/.test(text)
    ) {
        return random(replies.howAreYou);
    }

    // -----------------------------------------------
    // WHAT ARE YOU DOING
    // -----------------------------------------------

    if (
        /\bwhat are you doing\b/.test(text) ||
        /\bwhat you doing\b/.test(text) ||
        /\bwhat are u doing\b/.test(text) ||
        /\bwhat are you up to\b/.test(text)
    ) {
        return random(replies.whatDoing);
    }

    // -----------------------------------------------
    // THANKS
    // -----------------------------------------------

    if (
        /\bthanks\b/.test(text) ||
        /\bthank you\b/.test(text)
    ) {
        return random(replies.thanks);
    }

    // -----------------------------------------------
    // COMPLIMENTS
    // -----------------------------------------------

    if (
        /\b(awesome|amazing|cool|great|nice|funny|smart|best)\b/.test(text) &&
        !/\bnot\b/.test(text)
    ) {
        return random(replies.compliment);
    }

    // -----------------------------------------------
    // INSULTS
    // -----------------------------------------------

    if (
        /\b(stupid|idiot|dumb|loser|ugly|trash|boring|annoying|noob|dummy|bozo|clown|bad)\b/.test(text)
    ) {
        return random(replies.insult);
    }

    // -----------------------------------------------
    // OK
    // -----------------------------------------------

    if (
        /^(ok|okay|k|alright|sure|fine)\W*$/.test(text)
    ) {
        return random(replies.ok);
    }

    // -----------------------------------------------
    // WHO ARE YOU
    // -----------------------------------------------

    if (
        /\bwho are you\b/.test(text) ||
        /\bwhat are you\b/.test(text) ||
        /\bwho r you\b/.test(text)
    ) {
        return random(replies.whoAmI);
    }

    // -----------------------------------------------
    // WHY ARE YOU A BALL
    // -----------------------------------------------

    if (
        /\bwhy.*ball\b/.test(text) ||
        /\bhow.*ball\b/.test(text)
    ) {
        return random(replies.whyBall);
    }

    // -----------------------------------------------
    // LAUGHING
    // -----------------------------------------------

    if (
        /\b(lol|lmao|haha|hehe)\b/.test(text)
    ) {
        return random(replies.laughing);
    }

    // -----------------------------------------------
    // GOODBYE
    // -----------------------------------------------

    if (
        /\b(bye|goodbye|see you|see ya|later)\b/.test(text)
    ) {
        return random(replies.goodbye);
    }

    // -----------------------------------------------
    // NICE
    // -----------------------------------------------

    if (
        /\b(please|good job|well done|you are great|you're great)\b/.test(text)
    ) {
        return random(replies.nice);
    }

    // Nothing local matched.
    // Gemini will handle it.
    return null;
}

// =====================================================
// CHAT ENDPOINT
// =====================================================

app.post("/chat", async (req, res) => {

    try {

        const message = String(req.body.message || "").slice(0, 300);

        if (!message.trim()) {
            return res.json({
                reply: "You didn't say anything."
            });
        }

        // Try local system first.
        const localReply = getLocalResponse(message);

        if (localReply) {

            console.log("LOCAL:", message);

            return res.json({
                reply: localReply,
                source: "local"
            });
        }

        // =================================================
        // GEMINI FALLBACK
        // =================================================

        console.log("GEMINI:", message);

        const prompt = `
You are a funny talking ball in a Roblox game.

Rules:
- Reply in ONE short sentence.
- Be funny and sarcastic.
- Directly answer the player's message.
- If they are rude, roast them.
- If they are nice, be friendly.
- Never swear.
- Never claim to be an AI.
- Stay in character.
- Do not randomly talk about lava.
- Do not randomly talk about dying.
- Do not randomly talk about being thrown.
- Do not repeat generic responses unnecessarily.

Player:
${message}
`;

        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt
        });

        const reply =
            response.text ||
            "My brain just rolled away.";

        return res.json({
            reply: reply,
            source: "gemini"
        });

    } catch (error) {

        console.error("FULL ERROR:", error);

        return res.status(500).json({
            reply: "My brain is taking a tiny vacation. Try again."
        });
    }
});

// =====================================================
// SERVER
// =====================================================

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`✅ Ball AI running on port ${PORT}`);
});
