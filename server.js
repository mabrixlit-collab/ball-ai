export default {
  async fetch(request, env) {

    try {

      if (request.method === "GET") {
        return new Response("Ball AI is online!");
      }

      const body = await request.json();

      const playerId = String(body.playerId || "");
      const message = String(body.message || "");

      console.log("PLAYER:", playerId);
      console.log("MESSAGE:", message);

      if (!playerId || !message) {
        return Response.json({
          error: "Missing playerId or message"
        }, { status: 400 });
      }

      const key = `player:${playerId}`;

      // Try reading KV
      let memory = await env.BALL_MEMORY.get(key, {
        type: "json"
      });

      if (!memory) {
        memory = {
          name: null,
          messages: []
        };
      }

      // Save the message
      memory.messages.push(message);

      // Keep only the last 10
      if (memory.messages.length > 10) {
        memory.messages = memory.messages.slice(-10);
      }

      // Save to KV
      await env.BALL_MEMORY.put(
        key,
        JSON.stringify(memory)
      );

      console.log("KV TEST SUCCESS");

      return Response.json({
        reply: "KV works! You said: " + message,
        mood: "Neutral"
      });

    } catch (error) {

      console.error("KV TEST ERROR:", error);

      return Response.json({
        reply: "KV ERROR: " + (error?.message || String(error)),
        mood: "Neutral"
      }, {
        status: 500
      });
    }
  }
};
