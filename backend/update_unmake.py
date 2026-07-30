from server import DB

with DB() as cur:
    cur.execute("UPDATE cards SET text = 'Destroy target Entity.' WHERE name = 'Unmake'")
    print("Updated Unmake's oracle text in the database.")
