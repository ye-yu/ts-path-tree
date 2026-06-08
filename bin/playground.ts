import * as module from "node:module"
import * as http from "node:http"
import * as fs from "node:fs"
import * as util from "node:util"

const { values } = util.parseArgs({
  options: {
    "host": {
      short: "h",
      type: "boolean"
    }
  }
})

const htmlPath = './bin/index.html'
function getHtml() {
  const sourcePath = './src/path-tree.ts'
  const sourceCode = fs.readFileSync(sourcePath, 'utf-8')

  const stripped = module.stripTypeScriptTypes(sourceCode)
  const escaped = `\`${stripped.replaceAll('`', '\\`').replaceAll('$', '\\$')}\``
  const htmlTemplate = fs.readFileSync(htmlPath, 'utf8')
  const html = htmlTemplate.replaceAll('/* code */', escaped)
  return html
}

const docsDir = "./docs"
const docsIndex = "./docs/index.html"

fs.mkdirSync(docsDir, { recursive: true })
fs.writeFileSync(docsIndex, getHtml())
console.log("Updated docs/index.html")

if (!values.host) process.exit(0)

const server = http.createServer((_, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(getHtml())
})

server.listen(3000, () => {
  console.log('Server is running at http://localhost:3000')
})

const watcher = fs.watch(htmlPath, () => {
  fs.mkdirSync(docsDir, { recursive: true })
  fs.writeFileSync(docsIndex, getHtml())
  console.log("Updated docs/index.html")
})

process.on('SIGINT', () => {
  watcher.close()
  server.close(() => {
    console.log('Server stopped')
    process.exit(0)
  })
})