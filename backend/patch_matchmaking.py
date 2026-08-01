import re

with open('/home/ewilliamhe/GlimmerFall2/backend/server.py', 'r') as f:
    content = f.read()

# Replace insert_match definition
old_insert = """def insert_match(room_code, p1, p2, state):
    active_name = state["players"][state.get("activePlayer", 1) and str(state.get("activePlayer", 1))]["username"] if state.get("phase") == "PLAYING" else p1
    with DB() as cur:
        cur.execute(
            "INSERT INTO matches (room_code, player1, player2, status, current_turn, active_player, state) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (room_code, p1, p2, state.get("phase", "WAITING"), state.get("turn", 1), active_name, Json(state)),
        )
        return cur.fetchone()["id"]"""

new_insert = """def insert_match(room_code, p1, p2, state, p1_deck=None, p2_deck=None):
    active_name = state["players"][state.get("activePlayer", 1) and str(state.get("activePlayer", 1))]["username"] if state.get("phase") == "PLAYING" else p1
    with DB() as cur:
        cur.execute(
            "INSERT INTO matches (room_code, player1, player2, status, current_turn, active_player, state, player1_deck, player2_deck) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (room_code, p1, p2, state.get("phase", "WAITING"), state.get("turn", 1), active_name, Json(state), p1_deck, p2_deck),
        )
        return cur.fetchone()["id"]"""
content = content.replace(old_insert, new_insert)

# Replace AI match insert
content = content.replace("mid = insert_match(room, req.username, ge.AI_NAME, state)", 'mid = insert_match(room, req.username, ge.AI_NAME, state, req.deckName or "Custom", ai_deck.get("deck_name", "Random Chaos"))')

# Replace waiting match insert
content = content.replace("mid = insert_match(room, req.username, None, waiting_state)", 'mid = insert_match(room, req.username, None, waiting_state, req.deckName or "Custom", None)')
content = content.replace('waiting_state = {"phase": "WAITING", "activePlayer": 1, "turn": 1,\n                     "players": {"1": {"username": req.username}},\n                     "p1_deck": deck1, "log": [f"{req.username} created room {room}. Waiting for an opponent..."]}',
                          'waiting_state = {"phase": "WAITING", "activePlayer": 1, "turn": 1,\n                     "players": {"1": {"username": req.username}},\n                     "p1_deck": deck1, "p1_deck_name": req.deckName or "Custom", "log": [f"{req.username} created room {room}. Waiting for an opponent..."]}')

# Update Player 2 join logic
p2_join_old = """            state = ge.new_match_state(waiting["player1"], deck_p1, req.username, deck1, is_ai=False)
            save_match(waiting["id"], state)"""
p2_join_new = """            state = ge.new_match_state(waiting["player1"], deck_p1, req.username, deck1, is_ai=False)
            with DB() as cur:
                cur.execute("UPDATE matches SET player2=%s, player2_deck=%s WHERE id=%s", (req.username, req.deckName or "Custom", waiting["id"]))
            save_match(waiting["id"], state)"""
content = content.replace(p2_join_old, p2_join_new)

with open('/home/ewilliamhe/GlimmerFall2/backend/server.py', 'w') as f:
    f.write(content)
