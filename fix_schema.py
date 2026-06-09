import re

with open(r'E:\cs\网\页\端+客\户\端\supabase\schema.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix: ''text'' -> 'text'
fixes = [
    (\"DEFAULT '''',\", \"DEFAULT '',\"),
    (\"DEFAULT ''{}'',\", \"DEFAULT '{}',\"),
    (\"DEFAULT ''pending'',\", \"DEFAULT 'pending',\"),
    (\"IN (''pending'', ''accepted'', ''blocked'')\", \"IN ('pending', 'accepted', 'blocked')\"),
    (\"IN (''like'', ''dislike'')\", \"IN ('like', 'dislike')\"),
    (\"IN (''image'', ''video'')\", \"IN ('image', 'video')\"),
    (\"to_tsvector(''simple''\", \"to_tsvector('simple'\"),
    (\"|| '' '' ||\", \"|| ' ' ||\"),
]

for old, new in fixes:
    content = content.replace(old, new)

with open(r'E:\cs\网\页\端+客\户\端\supabase\schema.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done fixing schema.sql')
