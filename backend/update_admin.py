import sys
import re

with open("server.py", "r") as f:
    content = f.read()

replacement = """
        # 2. Referrals
        cur.execute("SELECT COALESCE(referral_source, 'Direct/Organic') as source, COUNT(*) as count FROM users GROUP BY source")
        referrals = [dict(r) for r in cur.fetchall()]
        
        # 2b. Top Referrers (User Referral Links)
        cur.execute(\"""
            SELECT u.nickname as referrer, COUNT(r.id) as count
            FROM referrals r
            JOIN users u ON r.referrer_id = u.id
            GROUP BY u.nickname
            ORDER BY count DESC
            LIMIT 50
        \""")
        top_referrers = [dict(r) for r in cur.fetchall()]
"""

pattern = r'\# 2\. Referrals\s*cur\.execute\("SELECT COALESCE\(referral_source, \'Direct/Organic\'\) as source, COUNT\(\*\) as count FROM users GROUP BY source"\)\s*referrals = \[dict\(r\) for r in cur\.fetchall\(\)\]'

new_content = re.sub(pattern, replacement.strip(), content, flags=re.DOTALL)

replacement_return = """    return {
        "deck_win_rates": deck_win_rates,
        "referrals": referrals,
        "top_referrers": top_referrers,
        "first_vs_second": {"""

pattern_return = r'    return \{\s*"deck_win_rates": deck_win_rates,\s*"referrals": referrals,\s*"first_vs_second": \{'

new_content = re.sub(pattern_return, replacement_return, new_content, flags=re.DOTALL)

with open("server.py", "w") as f:
    f.write(new_content)

