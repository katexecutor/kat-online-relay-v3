# KAT Game Connection

Your C++/Luau game connects to the relay using a secure WebSocket.

Connection format:

wss://YOUR-RELAY-URL/game?token=YOUR_SESSION_TOKEN

The game should handle these messages:

{"type":"connected","gameName":"KAT"}

{"type":"execute","requestId":"ID","source":"print('hello')"}

When your Luau VM finishes executing, it can optionally send:

{"type":"result","requestId":"ID","ok":true,"output":"hello"}

Keep session tokens private and use short-lived/device-bound tokens for production.
