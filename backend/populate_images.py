import requests, re, psycopg2
from requests.auth import HTTPBasicAuth

cloud='dfyh7cs1g'; key='734447488263944'; sec='fQgKFWGt0aw8kl8WgBN2z14RX-c'
DATABASE_URL="postgresql://neondb_owner:npg_c8rRimgWC1OG@ep-round-lab-atbehctx-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# fetch all resources with pagination
resources=[]
cursor=None
while True:
    params={'max_results':100,'type':'upload','prefix':'glimmerfall/'}
    if cursor: params['next_cursor']=cursor
    r=requests.get(f'https://api.cloudinary.com/v1_1/{cloud}/resources/image', auth=HTTPBasicAuth(key,sec), params=params).json()
    resources+=r.get('resources',[])
    cursor=r.get('next_cursor')
    if not cursor: break
print("Total cloudinary resources:", len(resources))

def slug(name):
    s=name.lower().replace("'","").replace("’","")
    s=re.sub(r'[^a-z0-9]+','_',s).strip('_')
    return s

# map slug -> secure_url (only card_renders, skip (1) duplicates)
cmap={}
cardback=None
for x in resources:
    pid=x['public_id']
    url=x['secure_url']
    if pid=='glimmerfall/baked_cardback' or 'cardback' in pid:
        cardback=url
    if pid.startswith('glimmerfall/card_renders/'):
        base=pid.split('/')[-1]
        if base.endswith(')'):  # skip duplicates like name(1)
            continue
        cmap[base]=url
print("card renders:", len(cmap), "| cardback:", cardback)

conn=psycopg2.connect(DATABASE_URL); cur=conn.cursor()
cur.execute("SELECT id, name FROM cards")
rows=cur.fetchall()
matched=0; missing=[]
for cid, name in rows:
    s=slug(name)
    url=cmap.get(s)
    if url:
        cur.execute("UPDATE cards SET image_url=%s WHERE id=%s",(url,cid))
        matched+=1
    else:
        missing.append((name,s))
conn.commit()
print("MATCHED:", matched, "/", len(rows))
print("MISSING:", missing)
print("\nUnused cloudinary slugs:", [k for k in cmap if k not in [slug(n) for _,n in rows]])
cur.close(); conn.close()
