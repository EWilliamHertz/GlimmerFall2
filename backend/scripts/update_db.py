from server import DB

with DB() as cur:
    # Ebon Duelist text update
    new_text = "Whenever this Entity attacks or is attacked, it gets +1/+0 until End Phase."
    cur.execute("UPDATE cards SET description = %s WHERE name = 'Ebon Duelist'", (new_text,))
    print("Updated Ebon Duelist.")
    
