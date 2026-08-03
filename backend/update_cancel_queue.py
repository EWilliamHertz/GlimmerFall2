with open('/home/ewilliamhe/GlimmerFall2/backend/server.py', 'r') as f:
    content = f.read()

endpoint_code = """
@api.delete("/matchmaking/{match_id}")
def cancel_matchmaking(match_id: int):
    with DB() as cur:
        cur.execute("DELETE FROM matches WHERE id=%s AND status='WAITING'", (match_id,))
    return {"status": "cancelled"}
"""

if "def cancel_matchmaking" not in content:
    content = content.replace('def _rand_room():', endpoint_code + '\ndef _rand_room():')
    with open('/home/ewilliamhe/GlimmerFall2/backend/server.py', 'w') as f:
        f.write(content)
    print("Added DELETE /matchmaking/{match_id} endpoint.")
else:
    print("Endpoint already exists.")
