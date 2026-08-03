import sys
import re

with open("server.py", "r") as f:
    content = f.read()

replacement = """@api.get("/users/{nickname}")
def get_user_profile(nickname: str):
    with DB() as cur:
        cur.execute("SELECT id, nickname, faction, avatar, wins, losses, mmr, rank FROM users WHERE nickname ILIKE %s", (nickname,))
        db_u = cur.fetchone()
        if not db_u:
            raise HTTPException(404, "User not found")
        
        # Get recent matches
        cur.execute(\"""
            SELECT m.id, m.created_at, m.status, m.player1, m.player2, m.state
            FROM matches m
            WHERE (m.player1 = %s OR m.player2 = %s) AND m.status = 'ENDED'
            ORDER BY m.created_at DESC
            LIMIT 10
        \""", (db_u['nickname'], db_u['nickname']))
        recent_matches = []
        for m in cur.fetchall():
            state = m['state'] or {}
            winner_slot = str(state.get('winner', '0'))
            
            p1_name = m['player1']
            p2_name = m['player2']
            
            if winner_slot == '1':
                winner_name = p1_name
            elif winner_slot == '2':
                winner_name = p2_name
            else:
                winner_name = "Draw"
                
            opponent = p2_name if p1_name == db_u['nickname'] else p1_name
            is_win = (winner_name == db_u['nickname'])
            
            recent_matches.append({
                "id": m['id'],
                "date": m['created_at'].isoformat() if m['created_at'] else None,
                "opponent": opponent,
                "result": "Win" if is_win else "Loss",
                "winner": winner_name
            })
            
    return {
        "id": db_u["id"],
        "nickname": db_u["nickname"],
        "faction": db_u["faction"],
        "avatar": db_u["avatar"],
        "wins": db_u["wins"] or 0,
        "losses": db_u.get("losses") or 0,
        "badges": db_u.get("badges") or [],
        "status": db_u.get("status") or "active",
        "matchmaking": {"mmr": db_u.get("mmr") or 1200, "rank": db_u.get("rank") or "Unranked"},
        "matchHistory": recent_matches
    }
"""

pattern = r'@api\.get\("/users/\{nickname\}"\)\s*def get_user_profile\(nickname:\s*str\):.*?(?=@api\.post\("/auth/verify"\))'

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open("server.py", "w") as f:
    f.write(new_content)

