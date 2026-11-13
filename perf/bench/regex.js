// regular expression exec with captures on a short string
function f(n) { const re = /(\d+)-([a-z]+)/; const str = 'abc 12345-hello xyz'; let t = 0; for (let i = 0; i < n; i++) { const m = re.exec(str); t += m[1].length + m[2].length; } return t; }
print(f(5000));
