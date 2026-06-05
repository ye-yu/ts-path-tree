import * as module from "node:module"
import * as http from "node:http"
import * as fs from "node:fs"
import * as util from "node:util"

const { values } = util.parseArgs({
  options: {
    "host": {
      short: "h",
      type: "string"
    }
  }
})

const sourcePath = './src/path-tree.ts'
const sourceCode = fs.readFileSync(sourcePath, 'utf-8')

const stripped = module.stripTypeScriptTypes(sourceCode)
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PathTree Playground</title>
  <style>
    body {
      margin: 0;
      font-family: sans-serif;
    }
    h1, p {
        padding-left: 1rem;
        padding-right: 1rem;
    }
    .container {
      display: flex;
      flex-direction: row;
      height: 80vh;
    }

    /* Mobile view: stack panels vertically */
    @media (max-width: 768px) {
      .container {
        flex-direction: column;
        height: auto; /* let panels size naturally */
      }
      .panel {
        width: 100%;
        height: auto;
      }
    }

    .panel {
      flex: 1;
      padding: 1rem;
      box-sizing: border-box;
    }
    textarea {
      width: 100%;
      height: 60%;
      min-height: 150px; /* ensures usable space */
      box-sizing: border-box;
      margin-bottom: 1rem;
      resize: vertical; /* allow manual resize if desired */
    }
    input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.5rem;
    }
    ul {
      padding-left: 1.2rem;
    }
  </style>
</head>
<body>
  <h1>PathTree Playground</h1>
  <p>Build and match path trees with parameters, wildcards, and optional route segments.</p>
  <p>Install: npm install path-tree-matcher</p>
  <div class="container">
    <div class="panel" id="left">
      <textarea id="patterns" placeholder="Enter patterns, one per line"></textarea>
      <input id="testInput" placeholder="Enter test pathname" />
    </div>
    <div class="panel" id="right">
      <h3>Matching Patterns</h3>
      <ul id="matches"></ul>
    </div>
  </div>

  <script type="module">
    // Load your stripped module dynamically
    const code = \`${stripped.replaceAll('`', '\\`').replaceAll('$', '\\$')}\`;
    const blob = new Blob([code], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const { PathTree } = await import(url);

    // Simple debounce helper
    function debounce(fn, delay = 100) {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
      };
    }

    const patternsEl = document.getElementById("patterns");
    const testEl = document.getElementById("testInput");
    const matchesEl = document.getElementById("matches");

    let tree = new PathTree();

    // Rebuild PathTree whenever patterns change
    const rebuildTree = debounce(() => {
      tree = new PathTree();
      localStorage.setItem("patterns", patternsEl.value);
      const lines = patternsEl.value.split("\\n").map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        tree.setPattern(line);
      }
      updateMatches();
    });

    // Update matches whenever test input changes
    const updateMatches = debounce(() => {
      const path = testEl.value.trim();
      matchesEl.innerHTML = "";
      if (!path) return;
      const results = tree.match(path);
      for (const r of results) {
        const li = document.createElement("li");
        li.textContent = r.pattern;
        matchesEl.appendChild(li);
      }
    });

    patternsEl.addEventListener("input", rebuildTree);
    testEl.addEventListener("input", updateMatches);

    patternsEl.value = localStorage.getItem("patterns") || [
      "/",                        // root
      "/about",                   // static page
      "/contact",                 // static page
      "/users/:id",               // user profile
      "/posts/:postId",           // blog post
      "/products/:sku",           // product detail
      "/blog/:year/:slug",        // nested params
      // --- API endpoints ---
      "/api/users",               // list users
      "/api/users/:id",           // get user by id
      "/api/posts",               // list posts
      "/api/posts/:postId",       // get post by id
      "/api/posts/:postId/comments", // nested resource
      "/api/products/:sku/reviews"   // product reviews
    ].join("\\n");
    rebuildTree();

  </script>
</body>
</html>
`

const docsDir = "./docs"
const docsIndex = "./docs/index.html"

fs.mkdirSync(docsDir, { recursive: true })
fs.writeFileSync(docsIndex, html)
console.log("Updated docs/index.html")

if (!values.host) process.exit(0)

const server = http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(html)
})

server.listen(3000, () => {
  console.log('Server is running at http://localhost:3000')
})

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server stopped')
    process.exit(0)
  })
})