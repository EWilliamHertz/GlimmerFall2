import re

with open('/home/ewilliamhe/GlimmerFall2/backend/server.py', 'r') as f:
    content = f.read()

# 1. Add badges and status to user profile serialization
auth_me_repl = """        "bookings": db_u.get("bookings") or 0,
        "badges": db_u.get("badges") or [],
        "status": db_u.get("status") or "active",
        "matchmaking": {"mmr": db_u.get("mmr") or 1200, "rank": db_u.get("rank") or "Unranked"}"""
content = re.sub(r'        "bookings": db_u\["bookings"\] or 0,\n        "matchmaking".*', auth_me_repl, content)

user_profile_repl = """        "losses": db_u.get("losses") or 0,
        "badges": db_u.get("badges") or [],
        "status": db_u.get("status") or "active",
        "matchmaking": {"mmr": db_u.get("mmr") or 1200, "rank": db_u.get("rank") or "Unranked"}"""
content = re.sub(r'        "losses": db_u\["losses"\] or 0,\n        "matchmaking".*', user_profile_repl, content)

login_verify_repl = """            "losses": u["losses"],
            "referrals": u["referrals"],
            "bookings": u["bookings"],
            "badges": u.get("badges", []),
            "status": u.get("status", "active"),
            "matchmaking": {"mmr": u["mmr"], "rank": u["rank"]}"""
content = re.sub(r'            "losses": u\["losses"\],\n            "referrals": u\["referrals"\],\n            "bookings": u\["bookings"\],\n            "matchmaking".*', login_verify_repl, content)

# 2. Reject banned users in login
login_check_repl = """    if not u or not bcrypt.checkpw(req.password.encode('utf-8'), u['password_hash'].encode('utf-8')):
        raise HTTPException(401, "Invalid credentials")
    if u.get("status") == "banned":
        raise HTTPException(403, "Account is banned")"""
content = content.replace("""    if not u or not bcrypt.checkpw(req.password.encode('utf-8'), u['password_hash'].encode('utf-8')):
        raise HTTPException(401, "Invalid credentials")""", login_check_repl)

# 3. Add admin suspend/ban endpoint
admin_status_endpoint = """
class UserStatusReq(BaseModel):
    status: str

@api.put("/admin/users/{target_id}/status")
def admin_set_user_status(target_id: int, req: UserStatusReq, request: Request):
    user = get_user_from_request(request)
    if not user or not user.get("is_admin"): raise HTTPException(403)
    if req.status not in ["active", "suspended", "banned"]:
        raise HTTPException(400, "Invalid status")
    with DB() as cur:
        cur.execute("UPDATE users SET status=%s WHERE id=%s", (req.status, target_id))
    return {"status": "success", "new_status": req.status}
"""
content = content.replace('@api.get("/admin/shop/orders")', admin_status_endpoint + '\n@api.get("/admin/shop/orders")')

with open('/home/ewilliamhe/GlimmerFall2/backend/server.py', 'w') as f:
    f.write(content)

print("Updated server.py successfully.")
