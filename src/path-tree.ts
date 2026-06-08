export type Token =
  | { token: string, type: "param" | "wildcard" }
  | { token: string, type: "group", groups: Token[] }
  | { token: string, type: "literal" }
export type TokenType = Token["type"]

export type MatchResult = { pattern: string, params: Record<string, string[]> }

export type PathNode = {
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


export class PathTree {
  root = newNode()

  setPattern(path: string, node: PathNode = this.root, expandedFrom?: string) {
    if (!path) {
      throw new Error("Path cannot be empty")
    }
    const tokens = this.parsePathTree(path)
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
          this.setPattern(joined, currentNode.groups[token.token], expandedFrom ?? path)
          break
        }
      }
    }
    currentNode.expandedFrom.push(expandedFrom ?? path)
  }

  collectLiterals(node: PathNode) {
    let toIterate: { startToken: string, lastNode: PathNode, finished?: true }[] = Object.entries(node.literals).map(([token, node]) => ({
      startToken: token,
      lastNode: node,
    }))

    let iterateNext: { startToken: string, lastNode: PathNode, finished?: true }[]
    const finished: { startToken: string, lastNode: PathNode, finished?: true }[] = []

    while (toIterate.length) {
      iterateNext = []
      for (const c of toIterate) {
        for (const [token, node] of Object.entries(c.lastNode.literals)) {
          iterateNext.push({
            startToken: c.startToken + token,
            lastNode: node
          })
        }

        if (
          Object.entries(c.lastNode.params).length
          || Object.entries(c.lastNode.wildcards).length
          || Object.entries(c.lastNode.groups).length
          || c.lastNode.expandedFrom.length) {
          finished.push({ ...c })
        }
      }
      toIterate = iterateNext
    }

    return finished
  }

  *matchRecursive(path: string, root: PathNode = this.root, param: Record<string, string[]> = {}): Generator<MatchResult> {
    for (const [token, node] of Object.entries(root.literals)) {
      if (path === token) {
        yield* node.expandedFrom.map(p => {
          return { pattern: p, params: { ...param } }
        })
        continue
      }

      if (path.startsWith(token)) {
        yield* this.matchRecursive(path.slice(token.length), node, { ...param })
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
        yield* this.matchRecursive(path.slice(index), node, newParam)
      } else {
        yield* node.expandedFrom.map(p => {
          return { pattern: p, params: newParam }
        })
      }
    }

    for (const [token, node] of Object.entries(root.wildcards)) {
      const nextLiterals = this.collectLiterals(node)
      if (!nextLiterals.length) {
        const newParam = {
          ...param,
          [token]: [...(param[token] ?? []), path]
        }
        yield* node.expandedFrom.map(p => {
          return { pattern: p, params: newParam }
        })
      } else {
        for (const { startToken, lastNode } of nextLiterals) {
          const index = path.indexOf(startToken)
          if (index === -1) continue
          const paramValue = path.slice(0, index)
          const newParam = {
            ...param,
            [token]: [...(param[token] ?? []), paramValue]
          }

          const nextPath = path.slice(index + startToken.length)
          if (nextPath) {
            yield* this.matchRecursive(nextPath, lastNode, newParam)
          } else {
            yield* lastNode.expandedFrom.map(p => {
              return { pattern: p, params: newParam }
            })
          }
        }
        // Also check if the wildcard node itself is a terminal (has expandedFrom)
        // This handles cases where the wildcard matches everything
        if (node.expandedFrom.length) {
          const newParam = {
            ...param,
            [token]: [...(param[token] ?? []), path]
          }
          yield* node.expandedFrom.map(p => {
            return { pattern: p, params: newParam }
          })
        }
      }
    }


    for (const [_, node] of Object.entries(root.groups)) {
      yield* this.matchRecursive(path, node, { ...param })
    }
  }

  match(path: string): MatchResult[] {
    return Array.from(this.matchRecursive(path))
  }


  *parsePathIntoSegments(pathname: string): Generator<string> {
    let lower = 0
    let upper = 0
    let depth = 0
    const delimiter = '/'
    const groupStart = '{'
    const groupEnd = '}'
    const paramDelimiter = ':'
    const wildcardDelimiter = '*'
    const groupQuotation = '"'

    while (upper < pathname.length) {
      if (pathname[upper] === groupQuotation) {
        if (pathname[lower] !== paramDelimiter && pathname[lower] !== wildcardDelimiter) {
          if (pathname.slice(lower, upper)) {
            yield pathname.slice(lower, upper)
          }
          lower = upper
        }
        do {
          upper++
        } while (upper < pathname.length && pathname[upper] !== groupQuotation)
        yield pathname.slice(lower, ++upper)
        lower = upper
      } else if (pathname[upper] === groupStart) {
        if (depth === 0) {
          if (pathname.slice(lower, upper)) {
            yield pathname.slice(lower, upper)
          }
          lower = upper
        }
        depth++
      } else if (pathname[upper] === groupEnd) {
        depth--
      } else if (depth === 0) {
        if (pathname[upper - 1] === groupEnd) {
          yield pathname.slice(lower, upper)
          lower = upper
        }

        if (pathname[upper] === delimiter) {
          if (pathname.slice(lower, upper)) {
            yield pathname.slice(lower, upper)
            lower = upper
          }
          yield pathname.slice(lower, upper + 1)
          lower = upper + 1
        } else if (pathname[upper] === paramDelimiter || pathname[upper] === wildcardDelimiter) {
          if (pathname.slice(lower, upper)) {
            yield pathname.slice(lower, upper)
            lower = upper
          }
        }
      }
      upper++
    }

    upper = Math.min(upper, pathname.length)
    if (lower < upper) {
      yield pathname.slice(lower, upper)
    }
  }

  parsePathTree(pathname: string, parent?: string): Token[] {
    const splitted = this.parsePathIntoSegments(pathname)
    const matched: Token[] = []
    for (const split of splitted) {
      if (split.startsWith("{")) {
        if (!split.endsWith("}")) {
          throw new Error(`Unterminated group of ${split} in path ${parent ?? pathname}`)
        }
        const group = split.slice(1, -1)
        matched.push({ token: split, type: "group", groups: this.parsePathTree(group, parent ?? pathname) })
        continue
      }

      if (split.startsWith(":")) {
        if (split.includes('*')) {
          throw new Error(`Unexpected token * of ${split}... in path ${parent ?? pathname}`)
        }

        const [_, ...tokens] = split.split(':')
        if (tokens.length > 1) {
          throw new Error(`Unexpected next tokens : of ${split} in path ${parent ?? pathname}`)
        }

        if (!split.slice(1)) {
          throw new Error(`Missing label of ${split} in path ${parent ?? pathname}`)
        }

        if (matched.at(-1)?.token === "param" || matched.at(-1)?.token === "wildcard") {
          throw new Error(`Unexpected next tokens : of ${split} in path ${parent ?? pathname}`)
        }

        matched.push({ type: "param", token: split })
        continue
      }

      if (split.includes('*')) {
        if (split.includes(':')) {
          throw new Error(`Unexpected token : of ${split}... in path ${parent ?? pathname}`)
        }

        const [_, ...wildcards] = split.split('*')
        if (wildcards.length > 1) {
          throw new Error(`Unexpected next token * of ${split}... in path ${parent ?? pathname}`)
        }

        if (!split.slice(1)) {
          throw new Error(`Missing lable of ${split} in path ${parent ?? pathname}`)
        }

        if (matched.at(-1)?.token === "param" || matched.at(-1)?.token === "wildcard") {
          throw new Error(`Unexpected next tokens : of ${split} in path ${parent ?? pathname}`)
        }

        const wildcard = wildcards[0]
        matched.push({ type: "wildcard", token: `*${wildcard}` })
        continue
      }

      matched.push({ token: split, type: "literal" })
    }
    return matched
  }
}