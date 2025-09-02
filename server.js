import express from "express";
import fetch from "node-fetch";
import { Twilio } from "twilio";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER,
  OPENAI_API_KEY,
  SHEET_CSV_URL,
  WIX_BOOKING_URL,
  PORT
} = process.env;

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
  console.warn("⚠️ Falta configurar credenciales de Twilio.");
}
if (!SHEET_CSV_URL) {
  console.warn("⚠️ Falta SHEET_CSV_URL (CSV publicado de Google Sheets).");
}
if (!WIX_BOOKING_URL) {
  console.warn("⚠️ Falta WIX_BOOKING_URL (link a tu página de reservas en Wix).");
}

const twilio = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

// Cache simple en memoria (5 minutos)
let cache = { data: [], ts: 0 };

async function loadCatalog() {
  const now = Date.now();
  if (now - cache.ts < 5 * 60 * 1000 && cache.data.length) return cache.data;
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error("No se pudo leer el CSV del catálogo");
  const text = await res.text();

  // Parseo CSV muy básico (sin comillas escapadas)
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(s => s.trim());
  const data = lines.slice(1).map(line => {
    const cells = line.split(",").map(s => s.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = (cells[i] ?? ""));
    return obj;
  });
  cache = { data, ts: now };
  return data;
}

function normalize(str) {
  return (str || "").toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function searchServices(catalog, query) {
  const q = normalize(query);
  const scoreRow = (row) => {
    const name = normalize(row.Servicio);
    const cat = normalize(row.Categoría);
    const notas = normalize(row.Notas);
    let score = 0;
    if (name.includes(q)) score += 3;
    if (cat.includes(q)) score += 2;
    if (notas.includes(q)) score += 1;
    return score;
  };
  return catalog
    .map(r => ({ row: r, score: scoreRow(r) }))
    .filter(x => x.score > 0)
    .sort((a,b) => b.score - a.score)
    .slice(0, 5)
    .map(x => x.row);
}

async function askAI(catalog, userText) {
  // Llamada simple a OpenAI (Chat Completions)
  const body = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Eres el asistente de ClouKo. Responde breve, cálido y concreto.
Usa EXCLUSIVAMENTE este catálogo para precios/duración:
${JSON.stringify(catalog).slice(0, 12000)} 
Si no hay match exacto, sugiere 2–3 alternativas del catálogo.
Nunca inventes precios. Termina con un CTA: "¿Te reservo?" y el link ${WIX_BOOKING_URL}.`
      },
      { role: "user", content: userText }
    ]
  };
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const t = await r.text();
    console.error("OpenAI error:", t);
    return "Estoy con intermitencia. ¿Podrías repetir más simple, por favor?";
  }
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || "¿Podrías repetir, por favor?";
}

app.post("/whatsapp", async (req, res) => {
  try {
    const from = req.body.From; // "whatsapp:+56..."
    const text = (req.body.Body || "").trim();
    const catalog = await loadCatalog();

    let reply;
    if (text.length <= 2) {
      reply = `¡Hola! Soy el asistente de ClouKo 💇‍♀️✨
Escríbeme el servicio que buscas (ej: "manicure", "balayage", "alisado").
Te responderé con precio y duración. ¿Te reservo? ${WIX_BOOKING_URL}`;
    } else {
      const hits = searchServices(catalog, text);
      if (hits.length) {
        const lines = hits.map(h => {
          const precio = h.Precio_CLP ? `${h.Precio_CLP} CLP` : "precio en salón";
          const dur = h.Duración_min ? `${h.Duración_min} min` : "duración variable";
          const nota = h.Notas ? ` — ${h.Notas}` : "";
          return `• ${h.Servicio} — ${precio} (${dur})${nota}`;
        });
        reply = `Esto es lo que encontré:\n${lines.join("\n")}\n\n¿Te reservo? ${WIX_BOOKING_URL}`;
      } else {
        reply = await askAI(catalog, text);
      }
    }

    await twilio.messages.create({
      from: TWILIO_WHATSAPP_NUMBER,
      to: from,
      body: reply
    });
    res.sendStatus(200);
  } catch (e) {
    console.error("Webhook error:", e);
    res.sendStatus(200);
  }
});

app.get("/", (_, res) => res.send("OK"));
const port = PORT || 3000;
app.listen(port, () => console.log("Servidor iniciado en puerto", port));
