package main

import (
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// The server only relays WebRTC handshake messages (offer / answer / candidate)
// between the two people in a room. Audio and video flow peer-to-peer.

type client struct {
	conn *websocket.Conn
	send chan []byte
}

type Hub struct {
	mu    sync.Mutex
	rooms map[string][]*client
}

func newHub() *Hub { return &Hub{rooms: map[string][]*client{}} }

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return isAllowedFrontendOrigin(r.Header.Get("Origin"))
	},
}

func (h *Hub) join(room string, c *client) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if len(h.rooms[room]) >= 2 {
		return false
	}
	for _, other := range h.rooms[room] {
		other.send <- []byte(`{"type":"peer-joined"}`)
	}
	h.rooms[room] = append(h.rooms[room], c)
	return true
}

func (h *Hub) leave(room string, c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	rest := h.rooms[room][:0]
	for _, o := range h.rooms[room] {
		if o != c {
			rest = append(rest, o)
			o.send <- []byte(`{"type":"peer-left"}`)
		}
	}
	if len(rest) == 0 {
		delete(h.rooms, room)
	} else {
		h.rooms[room] = rest
	}
}

func (h *Hub) relay(room string, from *client, msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, o := range h.rooms[room] {
		if o != from {
			select {
			case o.send <- msg:
			default:
			}
		}
	}
}

func (a *App) serveWS(w http.ResponseWriter, r *http.Request) {
	room := r.PathValue("room")

	// only real consultation rooms are allowed
	var exists bool
	err := a.db.QueryRow(r.Context(), `
		SELECT EXISTS (SELECT 1 FROM appointments WHERE room_id = $1::uuid AND status IN ('scheduled','in_progress'))`, room).Scan(&exists)
	if err != nil || !exists {
		http.Error(w, "unknown room", http.StatusNotFound)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	c := &client{conn: conn, send: make(chan []byte, 16)}

	// single writer goroutine: gorilla/websocket allows one concurrent writer
	go func() {
		for msg := range c.send {
			if conn.WriteMessage(websocket.TextMessage, msg) != nil {
				return
			}
		}
	}()

	if !a.hub.join(room, c) {
		conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"room-full"}`))
		conn.Close()
		return
	}
	defer func() {
		a.hub.leave(room, c)
		close(c.send)
		conn.Close()
	}()

	conn.SetReadLimit(64 << 10)
	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return
		}
		a.hub.relay(room, c, msg)
	}
}
