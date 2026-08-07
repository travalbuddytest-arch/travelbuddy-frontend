from pathlib import Path
import re

root = Path('g:/MAINTravalBuddy/MAINTravalBuddy/Frontend')
js_files = sorted(root.rglob('*.js'))
changed = []

patterns = [
    (re.compile(r"const API_ORIGIN = `\$\{window\.location\.origin\}`;"), "const API_ORIGIN = APP_CONFIG.API_BASE_URL;"),
    (re.compile(r"const SOCKET_ORIGIN = `\$\{window\.location\.origin\}`;"), "const SOCKET_ORIGIN = APP_CONFIG.SOCKET_URL;"),
    (re.compile(r"const API_BASE = `\$\{window\.location\.origin\}/api/auth`;"), "const API_BASE = `${APP_CONFIG.API_BASE_URL}/api/auth`;") ,
    (re.compile(r"var API_BASE = `\$\{window\.location\.origin\}/api/analytics`;"), "var API_BASE = `${APP_CONFIG.API_BASE_URL}/api/analytics`;") ,
    (re.compile(r"fetch\(\s*`\$\{window\.location\.origin\}/api/"), "fetch(`${APP_CONFIG.API_BASE_URL}/api/"),
    (re.compile(r"nativeFetch\(\s*`\$\{window\.location\.origin\}/api/"), "nativeFetch(`${APP_CONFIG.API_BASE_URL}/api/"),
    (re.compile(r"await nativeFetch\(\s*`\$\{window\.location\.origin\}/api/notifications/device-token`"), "await nativeFetch(`${APP_CONFIG.API_BASE_URL}/api/notifications/device-token`") ,
    (re.compile(r"await nativeFetch\(\s*`\$\{window\.location\.origin\}/api/auth/logout`"), "await nativeFetch(`${APP_CONFIG.API_BASE_URL}/api/auth/logout`") ,
    (re.compile(r"await nativeFetch\(\s*`\$\{window\.location\.origin\}/api/admin/logout`"), "await nativeFetch(`${APP_CONFIG.API_BASE_URL}/api/admin/logout`") ,
    (re.compile(r"window\.io\(\s*API_ORIGIN"), "window.io(APP_CONFIG.SOCKET_URL"),
    (re.compile(r"socket\s*=\s*window\.io\(\s*API_ORIGIN"), "socket = window.io(APP_CONFIG.SOCKET_URL"),
    (re.compile(r"io\(\s*API_ORIGIN"), "io(APP_CONFIG.SOCKET_URL"),
    (re.compile(r"window\.io\(\s*SOCKET_ORIGIN"), "window.io(APP_CONFIG.SOCKET_URL"),
    (re.compile(r"socket\s*=\s*window\.io\(\s*SOCKET_ORIGIN"), "socket = window.io(APP_CONFIG.SOCKET_URL"),
    (re.compile(r"io\(\s*SOCKET_ORIGIN"), "io(APP_CONFIG.SOCKET_URL"),
    (re.compile(r"io\(\s*`\$\{window\.location\.origin\}(/[^`]+)`\s*,"), r"io(APP_CONFIG.SOCKET_URL + '\1',"),
    (re.compile(r"window\.io\(\s*`\$\{window\.location\.origin\}(/[^`]+)`\s*,"), r"window.io(APP_CONFIG.SOCKET_URL + '\1',"),
]

for path in js_files:
    text = path.read_text(encoding='utf-8')
    original = text
    for pattern, replacement in patterns:
        text = pattern.sub(replacement, text)
    if text != original:
        path.write_text(text, encoding='utf-8')
        changed.append(str(path.relative_to(root)))

print('changed', len(changed))
for path in changed:
    print(path)
