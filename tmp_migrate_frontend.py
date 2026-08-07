from pathlib import Path

root = Path('g:/MAINTravalBuddy/MAINTravalBuddy/Frontend')
js_files = sorted(root.rglob('*.js'))
changed = []
replacements = [
    ('const API_ORIGIN = `${window.location.origin}`;', 'const API_ORIGIN = APP_CONFIG.API_BASE_URL;'),
    ('const SOCKET_ORIGIN = `${window.location.origin}`;', 'const SOCKET_ORIGIN = APP_CONFIG.SOCKET_URL;'),
    ('const API_BASE = `${window.location.origin}/api/auth`;', 'const API_BASE = `${APP_CONFIG.API_BASE_URL}/api/auth`;'),
    ('var API_BASE = `${window.location.origin}/api/analytics`;', 'var API_BASE = `${APP_CONFIG.API_BASE_URL}/api/analytics`;'),
    ('fetch(`${window.location.origin}/api/', 'fetch(`${APP_CONFIG.API_BASE_URL}/api/'),
    ('nativeFetch(`${window.location.origin}/api/', 'nativeFetch(`${APP_CONFIG.API_BASE_URL}/api/'),
    ("s.src = SOCKET_ORIGIN + '/socket.io/socket.io.js';", "s.src = APP_CONFIG.SOCKET_URL + '/socket.io/socket.io.js';"),
    ('const API_ORIGIN = `${window.location.origin}`;', 'const API_ORIGIN = APP_CONFIG.API_BASE_URL;'),
]
for path in js_files:
    text = path.read_text(encoding='utf-8')
    original = text
    for old, new in replacements:
        text = text.replace(old, new)
    if text != original:
        path.write_text(text, encoding='utf-8')
        changed.append(str(path.relative_to(root)))

print('changed', len(changed))
for p in changed:
    print(p)
