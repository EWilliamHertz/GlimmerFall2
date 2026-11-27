import re

with open('/home/ewilliamhe/GlimmerFall2/backend/server.py', 'r') as f:
    content = f.read()

new_endpoint = """
@api.get("/auth/me")
def get_me(request: Request):
    u = get_user_from_request(request)
    if not u:
        raise HTTPException(401, "Not logged in")
    with DB() as cur:
        cur.execute("SELECT * FROM users WHERE id=%s", (u["id"],))
        db_u = cur.fetchone()
    if not db_u:
        raise HTTPException(401, "User not found")
        
    return {
        "id": db_u["id"],
        "email": db_u["email"],
        "nickname": db_u["nickname"],
        "isAdmin": db_u["is_admin"],
        "isVerified": db_u["is_verified"],
        "faction": db_u["faction"],
        "avatar": db_u["avatar"],
        "wins": db_u["wins"] or 0,
        "losses": db_u["losses"] or 0,
        "referrals": db_u["referrals"] or 0,
        "bookings": db_u["bookings"] or 0,
        "matchmaking": {"mmr": db_u["mmr"] or 1200, "rank": db_u["rank"] or "Unranked"}
    }

@api.get("/users/{nickname}")
def get_user_profile(nickname: str):
    with DB() as cur:
        cur.execute("SELECT id, nickname, faction, avatar, wins, losses, mmr, rank FROM users WHERE nickname ILIKE %s", (nickname,))
        db_u = cur.fetchone()
    if not db_u:
        raise HTTPException(404, "User not found")
        
    return {
        "id": db_u["id"],
        "nickname": db_u["nickname"],
        "faction": db_u["faction"],
        "avatar": db_u["avatar"],
        "wins": db_u["wins"] or 0,
        "losses": db_u["losses"] or 0,
        "matchmaking": {"mmr": db_u["mmr"] or 1200, "rank": db_u["rank"] or "Unranked"}
    }

@api.post("/auth/verify")
"""

content = content.replace('@api.post("/auth/verify")', new_endpoint)

with open('/home/ewilliamhe/GlimmerFall2/backend/server.py', 'w') as f:
    f.write(content)
print("Added /auth/me and /users/{nickname} endpoints in server.py")
