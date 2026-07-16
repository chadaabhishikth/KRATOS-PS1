lines = open('eslint-error.txt', encoding='utf-16le').read().splitlines()
with open('eslint_short.txt', 'w', encoding='utf-8') as f:
    for l in lines:
        if '\\' in l or '/' in l or l.strip().endswith('.ts') or l.strip().endswith('.tsx'):
            parts = l.split('COGNIS\\')
            val = parts[-1] if parts else l
            f.write("FILE: " + val + "\n")
        elif 'error' in l.lower() or 'warning' in l.lower():
            f.write("   " + l.strip() + "\n")
