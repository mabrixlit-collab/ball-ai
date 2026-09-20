export default {
  async fetch(request, env) {

    try {

      if (request.method === "GET") {
        return new Response("Ball AI is online!");
      }

      const body = await request.json();

      const playerId = String(body.playerId || "");
      const message = String(body.message || "");

      if (!playerId || !message) {
        return Response.json({
          error: "Missing playerId or message"
        }, { status: 400 });
      }

      // TEST KV BINDING
      if (!env.BALL_MEMORY) {
        throw new Error("BALL_MEMORY binding is missing");
      }

      const key = "test:" + playerId;

      await env.BALL_MEMORY.put(
        key,
        JSON.stringify({
          message: message
        })
      );

      const saved = await env.BALL_MEMORY.get(
        key,
        { type: "json" }
      );

      return Response.json({
        reply: "KV works! You said: " + saved.message,
        mood: "Neutral"
      });

    } catch (error) {

      return Response.json({
        reply: "KV TEST ERROR: " + (error?.message || String(error)),
        mood: "Neutral"
      }, {
        status: 500
      });

    }

  }
};
