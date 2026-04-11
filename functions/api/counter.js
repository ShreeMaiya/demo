const json = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
};

function getCounterStub(env) {
  const id = env.COUNTER.idFromName("global");
  return env.COUNTER.get(id);
}

export async function onRequest(context) {
  const { request, env } = context;

  if (!env.COUNTER) {
    return json({ error: "Durable Object binding 'COUNTER' is missing." }, 500);
  }

  if (request.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        Allow: "GET, POST, PUT, DELETE, OPTIONS"
      }
    });
  }

  if (!["GET", "POST", "PUT", "DELETE"].includes(request.method)) {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    return await getCounterStub(env).fetch(request);
  } catch (error) {
    return json({ error: error?.message || "Internal server error." }, 500);
  }
}