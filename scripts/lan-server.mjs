/**
 * 실제 휴대폰으로 해 보는 개발용 서버. (운영에 쓰지 않는다)
 *
 * 만든 앱(dist/)을 내보내고, 같은 포트의 `/games/ws`에서 게임 중계를 한다. 중계 규칙은
 * 전단지 백엔드의 중계(flyer-g-be `src/games/game-relay.ts`)와 같다. 단 기기 토큰은
 * 확인하지 않는다(개발용). 컴퓨터와 폰이 같은 Wi-Fi에 있어야 한다.
 *
 *   bun run play:lan     (또는 npm run play:lan)
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 5180);
const DIST = fileURLToPath(new URL("../dist", import.meta.url));
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

// --- 정적 파일 (SPA: 없는 경로는 index.html) -----------------------------
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname));
  let file = join(DIST, path);
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error("dir");
  } catch {
    file = join(DIST, "index.html");
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(500).end("dist/가 없어요. 먼저 빌드하세요.");
  }
});

// --- 게임 중계 (flyer-g-be game-relay와 같은 프레임) ----------------------
const CLOSE = { replaced: 4010 };
/** @type {Map<string, { host: any, players: Map<string, any> }>} */
const rooms = new Map();
let nextId = 1;

const roomOf = (name) => {
  let room = rooms.get(name);
  if (!room) rooms.set(name, (room = { host: null, players: new Map() }));
  return room;
};
const toPlayers = (room, frame) => {
  const text = JSON.stringify(frame);
  for (const player of room.players.values()) player.send(text);
};

const wss = new WebSocketServer({ server, path: "/games/ws", maxPayload: 4096 });
wss.on("connection", (socket, req) => {
  const url = new URL(req.url ?? "", "http://x");
  const roomName = url.searchParams.get("room") ?? "";
  const role = url.searchParams.get("role");
  if (!/^[\w-]{1,64}$/.test(roomName) || (role !== "host" && role !== "player")) {
    socket.close(4003, "bad room or role");
    return;
  }
  const id = `c${nextId++}`;
  const room = roomOf(roomName);

  if (role === "player") {
    room.players.set(id, socket);
    socket.send(JSON.stringify({ type: "host", online: room.host !== null }));
  }

  socket.on("message", (raw) => {
    let frame;
    try {
      frame = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (role === "host" && frame.type === "auth") {
      // 개발용: 토큰을 확인하지 않는다. 같은 방에 TV가 새로 붙으면 이전 TV를 닫는다.
      if (room.host && room.host !== socket) room.host.close(CLOSE.replaced, "replaced");
      room.host = socket;
      socket.send(JSON.stringify({ type: "ready" }));
      toPlayers(room, { type: "host", online: true });
      return;
    }
    if (frame.type !== "send") return;
    if (role === "host" && room.host === socket) toPlayers(room, { type: "message", data: frame.data });
    if (role === "player" && room.host) {
      room.host.send(JSON.stringify({ type: "message", from: id, data: frame.data }));
    }
  });

  socket.on("close", () => {
    if (role === "host" && room.host === socket) {
      room.host = null;
      toPlayers(room, { type: "host", online: false });
    } else if (role === "player" && room.players.get(id) === socket) {
      room.players.delete(id);
      room.host?.send(JSON.stringify({ type: "left", from: id }));
    }
    if (!room.host && room.players.size === 0) rooms.delete(roomName);
  });
});

// --- 주소 안내 ------------------------------------------------------------
server.listen(PORT, "0.0.0.0", () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => net.address);
  const host = ips[0] ?? "localhost";
  console.log("\n셔플보드 폰 테스트 서버가 켜졌어요.\n");
  console.log(`  구관 TV 화면:  http://${host}:${PORT}/games/shuffleboard/old#token=dev`);
  console.log(`  신관 TV 화면:  http://${host}:${PORT}/games/shuffleboard/new#token=dev`);
  if (ips.length > 1) console.log(`  (다른 주소: ${ips.slice(1).join(", ")})`);
  console.log("\n  TV 화면은 이 컴퓨터 브라우저에서 위 주소로 여세요(localhost 말고 IP 주소로).");
  console.log("  폰은 같은 Wi-Fi에 연결한 뒤 TV 화면의 QR을 찍으면 돼요.\n");
});
