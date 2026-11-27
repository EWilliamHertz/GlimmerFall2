import re

with open('/home/ewilliamhe/GlimmerFall2/backend/server.py', 'r') as f:
    content = f.read()

new_get_match = """
@api.get("/match")
def get_match(id: int = Query(...), slot: int = Query(1)):
    import time
    from game_engine import apply_action
    
    with DB() as cur:
        cur.execute("SELECT * FROM matches WHERE id=%s", (id,))
        m = cur.fetchone()
        
        if not m:
            raise HTTPException(404, "Match not found")
        
        state = m["state"]
        
        # Enforce turn timer for ranked matches
        if m["is_ranked"] and state.get("phase") == "PLAYING" and state.get("turnStartedAt"):
            elapsed_ms = int(time.time() * 1000) - state["turnStartedAt"]
            if elapsed_ms > 90000: # 90 seconds rope
                try:
                    active = str(state.get("activePlayer", 1))
                    state = apply_action(state, active, "END_TURN", {})
                    cur.execute(
                        "UPDATE matches SET current_turn=%s, active_player=%s, state=%s WHERE id=%s",
                        (state["turn"], state["activePlayer"], json.dumps(state), id)
                    )
                except Exception as e:
                    pass

    return {
        "matchId": m["id"],
        "roomCode": m["room_code"],
        "status": m["status"],
        "turn": state.get("turn", m["current_turn"]),
        "activePlayer": state.get("activePlayer"),
        "player1": m["player1"],
        "player2": m["player2"],
        "is_ranked": m["is_ranked"],
        "state": redact_state(state, slot),
    }
"""

# Replace the existing get_match function
content = re.sub(
    r'@api\.get\("/match"\)\ndef get_match.*?return \{[^}]+\}',
    new_get_match.strip(),
    content,
    flags=re.DOTALL
)

with open('/home/ewilliamhe/GlimmerFall2/backend/server.py', 'w') as f:
    f.write(content)
print("Updated /match endpoint in server.py")
