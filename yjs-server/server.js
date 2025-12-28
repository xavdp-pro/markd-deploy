import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = 1234;
const rooms = new Map();
const roomStates = new Map();

const server = createServer((req, res) => {
    res.writeHead(200);
    res.end('SCS Server (ESM) is running');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    let currentRoom = null;
    let currentUser = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'join') {
                currentRoom = data.room;
                currentUser = data.user;
                if (!rooms.has(currentRoom)) rooms.set(currentRoom, new Set());
                rooms.get(currentRoom).add(ws);
                console.log(`[SCS] ${currentUser.name} joined ${currentRoom}`);
                if (roomStates.has(currentRoom)) {
                    ws.send(JSON.stringify({ type: 'sync-content', content: roomStates.get(currentRoom) }));
                }
                return;
            }

            if (currentRoom && rooms.has(currentRoom)) {
                if (data.type === 'content') roomStates.set(currentRoom, data.content);
                const broadcastData = JSON.stringify({ ...data });
                rooms.get(currentRoom).forEach(client => {
                    if (client !== ws && client.readyState === 1) client.send(broadcastData);
                });
            }
        } catch (e) {
            console.error('[SCS] Error:', e);
        }
    });

    ws.on('close', () => {
        if (currentRoom && rooms.has(currentRoom)) {
            rooms.get(currentRoom).delete(ws);
            if (rooms.get(currentRoom).size === 0) console.log(`[SCS] Room ${currentRoom} empty`);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SCS] Simple Collaborative Server started on port ${PORT}`);
});
