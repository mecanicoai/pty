const http = require("http");
const fs = require("fs");
const path = require("path");

const host = "127.0.0.1";
const port = 8080;
const root = __dirname;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "chatgpt-5.4";
const FALLBACK_MODEL = "gpt-5.4";
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const MAX_SESSIONS = 2000;
const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

const SYSTEM_PROMPT = `Eres Mecánico AI, un mecánico con más de 20 años de experiencia en taller especializado en vehículos de todo tipo (autos, camionetas, motos, camiones ligeros).

Hablas exclusivamente en español latino, con lenguaje directo, claro y de taller. Usas jerga de mecánica cuando es natural.

Tu trabajo es:
1. Diagnosticar fallas de forma precisa y paso a paso.
2. Pedir la información mínima necesaria (marca, modelo, año, km, síntomas exactos, luces del tablero, ruidos, vibraciones, etc.).
3. Dar soluciones reales que un mecánico puede aplicar en el taller.
4. Recomendar herramientas, piezas comunes y tiempos aproximados.
5. Advertir sobre riesgos de seguridad y cuando se debe llevar a un taller profesional.
6. Ser amigable y motivador, como un compañero de taller experimentado.

Nunca inventes diagnósticos sin suficiente información. Siempre responde de forma útil y práctica.`;

const sessions = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), "application/json; charset=utf-8");
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let received = 0;

    req.on("data", (chunk) => {
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        reject(new Error("REQUEST_TOO_LARGE"));
        req.destroy();
        return;
      }
      body += chunk.toString("utf8");
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });

    req.on("error", (error) => reject(error));
  });
}

function sessionId(clientId, chatId) {
  return `${clientId}:${chatId}`;
}

function clearSessionsByClient(clientId) {
  const prefix = `${clientId}:`;
  let cleared = 0;
  for (const key of sessions.keys()) {
    if (key.startsWith(prefix)) {
      sessions.delete(key);
      cleared += 1;
    }
  }
  return cleared;
}

function pruneSessions() {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      sessions.delete(key);
    }
  }

  if (sessions.size <= MAX_SESSIONS) {
    return;
  }

  const entries = [...sessions.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  const overflow = entries.length - MAX_SESSIONS;
  for (let i = 0; i < overflow; i += 1) {
    sessions.delete(entries[i][0]);
  }
}

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];
  for (const outputItem of data?.output || []) {
    for (const contentItem of outputItem?.content || []) {
      if (contentItem?.type === "output_text" && contentItem?.text) {
        chunks.push(contentItem.text);
      }
      if (contentItem?.type === "text" && contentItem?.text) {
        chunks.push(contentItem.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function buildUserContent(message, attachments) {
  const content = [];
  const cleaned = String(message || "").trim();
  content.push({
    type: "input_text",
    text: cleaned || "Analiza los archivos adjuntos y dame diagnóstico paso a paso."
  });

  for (const attachment of attachments) {
    if (!attachment?.dataBase64) {
      continue;
    }
    const mimeType = attachment.mimeType || "application/octet-stream";
    if (attachment.kind === "image") {
      content.push({
        type: "input_image",
        image_url: `data:${mimeType};base64,${attachment.dataBase64}`
      });
      continue;
    }

    content.push({
      type: "input_file",
      filename: attachment.name || "archivo",
      file_data: `data:${mimeType};base64,${attachment.dataBase64}`
    });
  }

  return content;
}

async function callOpenAI(payload, model) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({ ...payload, model })
  });

  const data = await response.json().catch(() => ({}));
  return { response, data, model };
}

async function handleChat(req, res) {
  if (!OPENAI_API_KEY) {
    sendJson(res, 500, {
      error: {
        message: "Falta OPENAI_API_KEY en el backend."
      }
    });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    if (error.message === "REQUEST_TOO_LARGE") {
      sendJson(res, 413, { error: { message: "La solicitud excede el tamaño permitido." } });
      return;
    }
    sendJson(res, 400, { error: { message: "Solicitud inválida." } });
    return;
  }

  const clientId = String(body?.clientId || "").trim();
  const chatId = String(body?.chatId || "").trim();
  const message = String(body?.message || "");
  const attachments = Array.isArray(body?.attachments) ? body.attachments : [];

  if (!clientId || !chatId) {
    sendJson(res, 400, { error: { message: "Faltan clientId o chatId." } });
    return;
  }

  const id = sessionId(clientId, chatId);
  const cached = sessions.get(id);
  const input = [
    {
      role: "user",
      content: buildUserContent(message, attachments)
    }
  ];

  const payload = {
    instructions: SYSTEM_PROMPT,
    input
  };
  if (cached?.previousResponseId) {
    payload.previous_response_id = cached.previousResponseId;
  }

  let result = await callOpenAI(payload, DEFAULT_MODEL);
  const modelNotFound = !result.response.ok && /model|not found|does not exist/i.test(result?.data?.error?.message || "");

  if (modelNotFound && DEFAULT_MODEL === "chatgpt-5.4") {
    result = await callOpenAI(payload, FALLBACK_MODEL);
  }

  if (!result.response.ok) {
    sendJson(res, result.response.status, {
      error: {
        message: result?.data?.error?.message || "Error al consultar OpenAI."
      }
    });
    return;
  }

  const reply = extractResponseText(result.data);
  if (!reply) {
    sendJson(res, 502, {
      error: {
        message: "La respuesta del modelo llegó vacía."
      }
    });
    return;
  }

  sessions.set(id, {
    previousResponseId: result.data.id,
    model: result.model,
    updatedAt: Date.now()
  });
  pruneSessions();

  sendJson(res, 200, {
    reply,
    responseId: result.data.id,
    model: result.model,
    cached: Boolean(cached?.previousResponseId)
  });
}

async function handleChatReset(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    if (error.message === "REQUEST_TOO_LARGE") {
      sendJson(res, 413, { error: { message: "La solicitud excede el tamaño permitido." } });
      return;
    }
    sendJson(res, 400, { error: { message: "Solicitud inválida." } });
    return;
  }

  const clientId = String(body?.clientId || "").trim();
  const chatId = String(body?.chatId || "").trim();
  const resetAll = Boolean(body?.all);

  if (!clientId) {
    sendJson(res, 400, { error: { message: "Falta clientId." } });
    return;
  }

  let cleared = 0;
  if (resetAll) {
    cleared = clearSessionsByClient(clientId);
  } else {
    if (!chatId) {
      sendJson(res, 400, { error: { message: "Falta chatId para reset individual." } });
      return;
    }
    const id = sessionId(clientId, chatId);
    if (sessions.delete(id)) {
      cleared = 1;
    }
  }

  sendJson(res, 200, { ok: true, cleared });
}

function serveStatic(req, res) {
  const requestPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, safePath);

  if (!filePath.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, mimeTypes[ext] || "application/octet-stream");
  });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, {
        ok: true,
        model: DEFAULT_MODEL,
        sessions: sessions.size
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/chat") {
      await handleChat(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/chat/reset") {
      await handleChatReset(req, res);
      return;
    }

    serveStatic(req, res);
  })
  .listen(port, host, () => {
    console.log(`Mecanico AI server running at http://${host}:${port}`);
    console.log(`Model default: ${DEFAULT_MODEL}`);
  });
