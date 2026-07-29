import os

with open('backend/server.py', 'r') as f:
    content = f.read()

# Replace admin_telemetry
old_telemetry = """@api.get("/admin/telemetry")
def admin_telemetry():
    # Telemetry data mock for the dashboard (until full pipeline is built)
    # Real telemetry pipeline pending
    return {
        "most_drafted_cards": [],
        "faction_win_rates": [],
        "first_vs_second": {
            "first": 50,
            "second": 50
        }
    }"""

new_telemetry = """@api.get("/admin/telemetry")
def admin_telemetry():
    with DB() as cur:
        # 1. Deck Win Rates
        cur.execute(\"\"\"
            SELECT d.id, d.name,
                SUM(CASE WHEN m.winner = d.user_id THEN 1 ELSE 0 END) as wins,
                COUNT(m.id) as total_games
            FROM decks d
            JOIN matches m ON (m.player_1_deck_id = d.id OR m.player_2_deck_id = d.id)
            WHERE m.status = 'FINISHED'
            GROUP BY d.id, d.name
            ORDER BY total_games DESC, wins DESC
        \"\"\")
        raw_decks = cur.fetchall()
        deck_win_rates = []
        for rd in raw_decks:
            win_rate = (rd["wins"] / rd["total_games"]) * 100 if rd["total_games"] > 0 else 0
            deck_win_rates.append({
                "deck": rd["name"],
                "winRate": round(win_rate, 1),
                "totalGames": rd["total_games"]
            })

        # 2. Referrals
        cur.execute("SELECT COALESCE(referral_source, 'Direct/Organic') as source, COUNT(*) as count FROM users GROUP BY source")
        referrals = [dict(r) for r in cur.fetchall()]
        
        # 3. First vs Second
        cur.execute("SELECT COUNT(*) as c FROM matches WHERE status='FINISHED' AND winner = (SELECT id FROM users WHERE username = player_1_username LIMIT 1)")
        p1_wins = cur.fetchone()["c"]
        cur.execute("SELECT COUNT(*) as c FROM matches WHERE status='FINISHED' AND winner = (SELECT id FROM users WHERE username = player_2_username LIMIT 1)")
        p2_wins = cur.fetchone()["c"]
        
        total_p = p1_wins + p2_wins
        first_win = round((p1_wins / total_p * 100), 1) if total_p > 0 else 50
        second_win = round((p2_wins / total_p * 100), 1) if total_p > 0 else 50

    return {
        "deck_win_rates": deck_win_rates,
        "referrals": referrals,
        "first_vs_second": {
            "first": first_win,
            "second": second_win
        }
    }"""

content = content.replace(old_telemetry, new_telemetry)

# Append new routes
new_routes = """
@api.get("/admin/users")
def get_admin_users(request: Request):
    user = getattr(request.state, "user", None)
    if not user or not user.get("isAdmin"):
        raise HTTPException(403, "Access denied")
    with DB() as cur:
        cur.execute("SELECT id, username, email, is_admin FROM users ORDER BY id DESC")
        return [dict(r) for r in cur.fetchall()]

@api.post("/admin/users/{target_id}/toggle_admin")
def toggle_admin(target_id: int, request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(401, "Not logged in")
    
    # Check if caller is one of the owners
    owner_emails = ["swagyser9@gmail.com", "ernst@hatake.eu"]
    if user.get("email") not in owner_emails:
        raise HTTPException(403, "Only owners can modify admin roles")
        
    with DB() as cur:
        cur.execute("SELECT is_admin FROM users WHERE id=%s", (target_id,))
        target = cur.fetchone()
        if not target:
            raise HTTPException(404, "User not found")
        
        new_status = not target["is_admin"]
        cur.execute("UPDATE users SET is_admin=%s WHERE id=%s", (new_status, target_id))
    return {"status": "success", "is_admin": new_status}

@api.get("/admin/shop/orders")
def admin_get_shop_orders(request: Request):
    user = getattr(request.state, "user", None)
    if not user or not user.get("isAdmin"):
        raise HTTPException(403, "Access denied")
    with DB() as cur:
        cur.execute(\"\"\"
            SELECT o.id, u.email as user_email, o.first_name, o.last_name, 
                   o.address, o.country, o.shipping_cost, o.total_amount, o.status, o.created_at
            FROM shop_orders o
            LEFT JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        \"\"\")
        orders = []
        for r in cur.fetchall():
            rd = dict(r)
            rd["created_at"] = str(rd["created_at"])
            # Calculate net profit (total_amount - shipping_cost)
            t = float(rd["total_amount"] or 0)
            s = float(rd["shipping_cost"] or 0)
            rd["net_profit"] = t - s
            orders.append(rd)
        return orders
"""

if "@api.get(\"/admin/shop/orders\")" not in content:
    content = content.replace('uvicorn.run("server:api", host="127.0.0.1", port=8000, reload=True)', 'uvicorn.run("server:api", host="127.0.0.1", port=8000, reload=True)' + new_routes)

with open('backend/server.py', 'w') as f:
    f.write(content)

print("server.py patched!")
