// index.js
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const mqtt = require("mqtt");

const PORT = process.env.PORT || 8080;

// === MQTT config via env vars ===
const MQTT_URL   = process.env.MQTT_URL   || "mqtt://127.0.0.1:1883";
const MQTT_TOPIC = process.env.MQTT_TOPIC || "marvin/nav/start";
const MQTT_QOS   = Number(process.env.MQTT_QOS || 0);   // 0,1,2
const MQTT_RETAIN = (process.env.MQTT_RETAIN || "false") === "true";

// === MQTT client ===
const mclient = mqtt.connect(MQTT_URL);
mclient.on("connect", () => {
  console.log(`[${new Date().toISOString()}] MQTT connected → ${MQTT_URL}`);
});
mclient.on("error", (err) => {
  console.error(`[${new Date().toISOString()}] MQTT error:`, err.message);
});

const app = express();

// body parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.text({ type: "text/*", limit: "1mb" }));

// Health
app.get("/health", (req, res) => {
  const up = mclient.connected ? "up" : "degraded";
  res.json({ status: "up", mqtt: up });
});

// HTTP ingest (optioneel, handig voor debug)
app.post("/ingest", express.raw({ type: "*/*", limit: "2mb" }), (req, res) => {
  const ts = new Date().toISOString();
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const bodyStr = req.body?.toString("utf8") || "";
  try {
    const asJson = JSON.parse(bodyStr || "null");
    console.log(`[${ts}] HTTP JSON from ${ip}:`, asJson);
    return res.json({ status: "ok", seenType: "json" });
  } catch {
    console.log(`[${ts}] HTTP TEXT from ${ip}:`, bodyStr);
    return res.json({ status: "ok", seenType: "text" });
  }
});

// === NIEUW: start_nav → publish naar MQTT ===
// Voorbeeld body:
// { "goal": {"x": 2.3, "y": -1.1, "frame": "map"}, "meta": {"source":"ewm","jobId":"123"} }
app.post("/start_nav", (req, res) => {
  const ts = new Date().toISOString();
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  // Zorg dat we altijd geldige JSON publiceren
  const payload = {
    goal: req.body?.goal ?? null,
    meta: req.body?.meta ?? {},
    // voeg een server-side timestamp toe
    ts,
  };

  const msg = JSON.stringify(payload);
  mclient.publish(
    MQTT_TOPIC,
    msg,
    { qos: MQTT_QOS, retain: MQTT_RETAIN },
    (err) => {
      if (err) {
        console.error(`[${ts}] MQTT publish error → topic=${MQTT_TOPIC}:`, err.message);
        return res.status(500).json({ status: "error", error: "mqtt_publish_failed" });
      }
      console.log(
        `[${ts}] /start_nav from ${ip} → published to ${MQTT_TOPIC} (qos=${MQTT_QOS}, retain=${MQTT_RETAIN}) : ${msg}`
      );
      res.json({ status: "ok", topic: MQTT_TOPIC });
    }
  );
});

// HTTP + WS op dezelfde server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const ts = new Date().toISOString();
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.log(`[${ts}] WS connected from ${ip}`);
  ws.send("connected");

  ws.on("message", (data) => {
    const ts2 = new Date().toISOString();
    console.log(`[${ts2}] WS from ${ip}: ${data}`);
    ws.send(`echo: ${data}`);
  });

  ws.on("close", () => {
    const ts3 = new Date().toISOString();
    console.log(`[${ts3}] WS closed from ${ip}`);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[${new Date().toISOString()}] Gateway listening on :${PORT}`);
  console.log(`[${new Date().toISOString()}] Will publish to ${MQTT_URL} topic "${MQTT_TOPIC}"`);
});
