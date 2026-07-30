from server import DB

with DB() as cur:
    cur.execute("SELECT * FROM starter_decks")
    s_decks = cur.fetchall()
    
    for sd in s_decks:
        cur.execute("SELECT id FROM decks WHERE deck_name=%s AND is_preconstructed=TRUE", (sd['deck_name'],))
        if cur.fetchone(): continue
        
        cur.execute("INSERT INTO decks (username, deck_name, is_preconstructed) VALUES (%s, %s, TRUE) RETURNING id", ("GlimmerFall Official", sd['deck_name']))
        new_deck_id = cur.fetchone()['id']
        
        cur.execute("SELECT card_name, count FROM starter_deck_cards WHERE starter_deck_id=%s", (sd['id'],))
        s_cards = cur.fetchall()
        
        for sc in s_cards:
            cur.execute("INSERT INTO deck_cards (deck_id, card_name, count) VALUES (%s, %s, %s)", (new_deck_id, sc['card_name'], sc['count']))
            
    print("Migrated starter decks to preconstructed decks!")
