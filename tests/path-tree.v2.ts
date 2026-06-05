import { PathTree } from '../src/path-tree.ts';

class MetaString<T extends object> extends String {
  meta: T;
  constructor(...args: any[]) {
    super(...args);
    this.meta = {} as T;
  }
}

type MatchResult = { pattern: string, params: Record<string, string[]> }

type PathNode = {
  literals: Record<string, PathNode>,
  params: Record<string, PathNode>,
  wildcards: Record<string, PathNode>,
  groups: Record<string, PathNode>,
  expandedFrom: string[],
}

function newNode(): PathNode {
  return {
    literals: {},
    params: {},
    wildcards: {},
    groups: {},
    expandedFrom: [],
  }
}

function lastIndexOf(str: string, search: string): number {
  let lastIndex = -1
  let index = str.indexOf(search)
  while (index !== -1) {
    lastIndex = index
    index = str.indexOf(search, index + 1)
  }
  return lastIndex
}

const root: PathNode = newNode()

const parsePathTreeV2 = PathTree.prototype.parsePathTree.bind(PathTree.prototype)

const patterns = [
  "/api/v1/*all",
  "/api/v1{/:types}/:id",
  "/api/v1{/:actions}/:id",
  "/api/v1/files/*paths",
  "/api/v1/files/*paths/txt",
  "/api/v1/health",
  "/api/v2/health",
]

function setPattern(node: PathNode, path: string, expandedFrom?: string) {
  if (!path) {
    throw new Error("Path cannot be empty")
  }
  const tokens = parsePathTreeV2(path)
  let currentNode = node
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    currentNode[`${token.type}s`][token.token] ??= newNode()
    switch (token.type) {
      case "literal": {
        currentNode = currentNode.literals[token.token]
        break
      }
      case "param": {
        if (token.token.length < 2) {
          throw new Error(`Parameter token ${token.token} is too short in path ${path}`)
        }

        if (tokens[i - 1]?.type === "param" || tokens[i - 1]?.type === "wildcard") {
          throw new Error(`Unexpected consecutive parameter tokens : ${token.token} in path ${path}`)
        }

        currentNode = currentNode.params[token.token]
        break
      }
      case "wildcard": {
        if (token.token.length < 2) {
          throw new Error(`Parameter token ${token.token} is too short in path ${path}`)
        }

        if (tokens[i - 1]?.type === "param" || tokens[i - 1]?.type === "wildcard") {
          throw new Error(`Unexpected consecutive parameter tokens : ${token.token} in path ${path}`)
        }

        currentNode = currentNode.wildcards[token.token]
        break
      }
      case "group": {
        const joined = [token.token.slice(1, -1), ...tokens.slice(i + 1).map(e => e.token)].join('')
        setPattern(currentNode.groups[token.token], joined, expandedFrom ?? path)
        break
      }
    }
  }
  currentNode.expandedFrom.push(expandedFrom ?? path)
}

function* matchRecursive(root: PathNode, path: string, param: Record<string, string[]> = {}): Generator<MatchResult> {
  for (const [token, node] of Object.entries(root.literals)) {
    if (path.startsWith(token)) {
      yield* matchRecursive(node, path.slice(token.length), { ...param })
      yield* node.expandedFrom.map(p => {
        return { pattern: p, params: { ...param } }
      })
    }
  }

  for (const [token, node] of Object.entries(root.params)) {
    // must only match literal of '/' next
    const indexOfSlash = path.indexOf("/")
    const index = indexOfSlash === -1 ? path.length : indexOfSlash
    const paramValue = path.slice(0, index)
    const newParam = {
      ...param,
      [token]: [...(param[token] ?? []), paramValue]
    }

    if (path.slice(index)) {
      yield* matchRecursive(node, path.slice(index), newParam)
    } else {
      yield* node.expandedFrom.map(p => {
        return { pattern: p, params: newParam }
      })
    }
  }

  const wcEntries = Object.entries(root.wildcards)
  if (wcEntries.length) {
    const splitted = parsePathTreeV2(path)
    let joined = ''
    for (const { token } of splitted) {
      joined += token
      for (const [token, node] of wcEntries) {
        // must match literal next after '/'
        for (const [nextToken, nextNode] of Object.entries(node.literals)) {
          const index = lastIndexOf(joined, nextToken)
          if (index === -1) continue
          const paramValue = joined.slice(0, index)
          const newParam = {
            ...param,
            [token]: [...(param[token] ?? []), paramValue]
          }
          yield* matchRecursive(nextNode, joined.slice(index + 1), newParam)
        }
        // else match the rest of the joined
        if (joined === path) {
          const newParam = {
            ...param,
            [token]: [...(param[token] ?? []), joined]
          }
          yield* node.expandedFrom.map(p => {
            return { pattern: p, params: newParam }
          })
        }
      }
    }
  }

  for (const [_, node] of Object.entries(root.groups)) {
    yield* matchRecursive(node, path, { ...param })
  }
}



for (const pattern of patterns) {
  console.log(`Inserting pattern: ${pattern}`)
  setPattern(root, pattern)
}
console.log('-----')
// console.log(JSON.stringify(root, null, 2))

const testPaths = [
  "/api/v1/health",
  "/api/v2/health",
  "/api/v1/files/path/to/file",
  "/api/v1/files/path/to/file/txt",
  "/api/v1/users/123",
  "/api/v1/posts/456",
  "/api/v1/comments/789",
]

for (const testPath of testPaths) {
  console.log(`Matching path: ${testPath}`)
  const matches = [...matchRecursive(root, testPath)]
  for (const match of matches) {
    console.log(`Matched pattern: ${match.pattern}, params: ${JSON.stringify(match.params)}`)
  }
  console.log("-----")
}