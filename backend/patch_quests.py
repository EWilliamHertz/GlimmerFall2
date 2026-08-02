import re
with open('/home/ewilliamhe/GlimmerFall2/backend/server.py', 'r') as f:
    content = f.read()

# Add Admin Quests endpoints
admin_quests_code = """
@api.get("/admin/quests")
def get_admin_quests(request: Request):
    if not get_current_user(request).get('is_admin'): raise HTTPException(403)
    with DB() as cur:
        cur.execute("SELECT * FROM daily_quests ORDER BY quest_date ASC")
        return cur.fetchall()

class GenerateQuestsReq(BaseModel):
    days: int

@api.post("/admin/quests/generate")
def generate_admin_quests(req: GenerateQuestsReq, request: Request):
    if not get_current_user(request).get('is_admin'): raise HTTPException(403)
    import random
    from datetime import date, timedelta
    q_types = [
        ("Win 3 games", 3, "1 Booster Pack"),
        ("Play 10 Rites", 10, "50 Glimmer"),
        ("Deal 50 damage to enemy Nexus", 50, "100 Glimmer"),
        ("Play 5 Solari Entities", 5, "25 Glimmer"),
        ("Cast 5 Flash spells", 5, "25 Glimmer")
    ]
    with DB() as cur:
        # Get the latest quest date, or start from today
        cur.execute("SELECT MAX(quest_date) as max_date FROM daily_quests")
        max_date = cur.fetchone()["max_date"]
        start_date = max_date + timedelta(days=1) if max_date else date.today()
        
        for i in range(req.days):
            target_date = start_date + timedelta(days=i)
            desc, tgt, rw = random.choice(q_types)
            try:
                cur.execute("INSERT INTO daily_quests (quest_date, description, target_value, reward) VALUES (%s, %s, %s, %s)", (target_date, desc, tgt, rw))
            except:
                pass
    return {"ok": True}

@api.post("/admin/quests/{qid}/approve")
def approve_admin_quest(qid: int, request: Request):
    if not get_current_user(request).get('is_admin'): raise HTTPException(403)
    with DB() as cur:
        cur.execute("UPDATE daily_quests SET is_approved = TRUE WHERE id = %s", (qid,))
    return {"ok": True}

@api.delete("/admin/quests/{qid}")
def delete_admin_quest(qid: int, request: Request):
    if not get_current_user(request).get('is_admin'): raise HTTPException(403)
    with DB() as cur:
        cur.execute("DELETE FROM daily_quests WHERE id = %s", (qid,))
    return {"ok": True}
"""

if "def get_admin_quests" not in content:
    content = content.replace('@api.get("/admin/stats")', admin_quests_code + '\n@api.get("/admin/stats")')

# Update get_my_quests to use daily_quests
old_quests = """@api.get("/auth/me/quests")
def get_my_quests(request: Request):
    user = get_current_user(request)
    with DB() as cur:
        # Auto-generate daily quests if none active
        cur.execute("SELECT * FROM user_quests WHERE user_id=%s AND created_at >= NOW() - INTERVAL '1 day'", (user['id'],))
        quests = cur.fetchall()
        if not quests:
            import random
            q_types = [
                ("Win 3 games", 3, "1 Booster Pack"),
                ("Play 10 Rites", 10, "50 Glimmer"),
                ("Deal 50 damage to enemy Nexus", 50, "100 Glimmer")
            ]
            for desc, tgt, rw in random.sample(q_types, 2):
                cur.execute("INSERT INTO user_quests (user_id, description, target_value, reward) VALUES (%s, %s, %s, %s) RETURNING *", (user['id'], desc, tgt, rw))
                quests.append(cur.fetchone())
        return quests"""

new_quests = """@api.get("/auth/me/quests")
def get_my_quests(request: Request):
    user = get_current_user(request)
    with DB() as cur:
        cur.execute("SELECT * FROM user_quests WHERE user_id=%s AND created_at >= NOW() - INTERVAL '1 day'", (user['id'],))
        quests = cur.fetchall()
        
        # Check if there is an approved global daily quest for today that the user doesn't have
        cur.execute("SELECT * FROM daily_quests WHERE quest_date = CURRENT_DATE AND is_approved = TRUE")
        daily_quest = cur.fetchone()
        
        if daily_quest:
            # Check if user already has this specific quest active
            has_it = any(q['description'] == daily_quest['description'] for q in quests)
            if not has_it:
                cur.execute("INSERT INTO user_quests (user_id, description, target_value, reward) VALUES (%s, %s, %s, %s) RETURNING *", (user['id'], daily_quest['description'], daily_quest['target_value'], daily_quest['reward']))
                quests.append(cur.fetchone())
                
        # Fallback to random if they have nothing and there's no global quest
        if not quests:
            import random
            q_types = [
                ("Win 3 games", 3, "1 Booster Pack"),
                ("Play 10 Rites", 10, "50 Glimmer"),
            ]
            for desc, tgt, rw in random.sample(q_types, 1):
                cur.execute("INSERT INTO user_quests (user_id, description, target_value, reward) VALUES (%s, %s, %s, %s) RETURNING *", (user['id'], desc, tgt, rw))
                quests.append(cur.fetchone())
        return quests"""

content = content.replace(old_quests, new_quests)

with open('/home/ewilliamhe/GlimmerFall2/backend/server.py', 'w') as f:
    f.write(content)
