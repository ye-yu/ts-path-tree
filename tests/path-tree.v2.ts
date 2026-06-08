import { PathTree } from '../src/path-tree.ts';

const root = new PathTree
const patterns = [
  "/api/v1/*all",
  "/api/v1{/:types}/:id",
  "/api/v1{/:actions}/:id",
  "/api/compare/*first/-/*second",
  "/api/compare/*first/data/*second",
  "/api/v1/files/*paths",
  "/api/v1/files/*paths/txt",
  "/api/v1/health",
  "/api/v2/health",
]


for (const pattern of patterns) {
  console.log(`Inserting pattern: ${pattern}`)
  root.setPattern(pattern)
}
console.log('-----')
console.log(JSON.stringify(root, null, 2))

const testPaths = [
  "/api/v1/health",
  "/api/v2/health",
  "/api/v1/files/path/to/file",
  "/api/v1/files/path/to/file/txt",
  "/api/v1/users/123",
  "/api/v1/posts/456",
  "/api/v1/comments/789",
  "/api/compare/abc/-/def",
  "/api/compare/abc/another-one/data/-/def/hello",
]

for (const testPath of testPaths) {
  console.log(`Matching path: ${testPath}`)
  const matches = root.match(testPath)
  for (const match of matches) {
    console.log(`Matched pattern: ${match.pattern}, params: ${JSON.stringify(match.params)}`)
  }
  console.log("-----")
}