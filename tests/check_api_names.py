"""Every name in js/api.js must be defined once. A duplicate silently replaces the first (Phase 24 broke Work this way)."""
import re, sys
from collections import Counter
src = open(__file__.rsplit('/tests/', 1)[0] + '/public_html/js/api.js').read()
body = src[src.index('api = {'):]
dups = [k for k, n in Counter(re.findall(r'^\s{2}([A-Za-z_$][\w$]*)\s*:', body, re.M)).items() if n > 1]
print('api.js names defined twice:', dups or 'none'); sys.exit(1 if dups else 0)
