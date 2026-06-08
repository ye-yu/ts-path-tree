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

export class PathTree {
  root = newNode()

  setPattern(path: string, node: PathNode = this.root, expandedFrom?: string) {
    if (!path) {
      throw new Error("Path cannot be empty")
    }

    let states = [{ path, node, expandedFrom }]
    let nextState: typeof states;
    while (states.length) {
      nextState = []
      for (const { path, node, expandedFrom } of states) {
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
              nextState.push({
                path: joined,
                node: currentNode.groups[token.token],
                expandedFrom: expandedFrom ?? path,
              })
              break
            }
          }
        }
        currentNode.expandedFrom.push(expandedFrom ?? path)
      }

      states = nextState
    }
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

  match(path: string): MatchResult[]
  match(path: string, root: PathNode, param: Record<string, string[]>): MatchResult[]
  match(path: string, root: PathNode = this.root, param: Record<string, string[]> = {}): MatchResult[] {
    const results: MatchResult[] = []
    let states = [
      {
        path,
        root,
        param,
      }
    ]
    let nextState: typeof states;

    while (states.length) {
      nextState = []
      for (const { path, root, param } of states) {
        for (const [token, node] of Object.entries(root.literals)) {
          if (path === token) {
            const result = node.expandedFrom.map(p => {
              return { pattern: p, params: { ...param } }
            })
            results.push(...result)
            continue
          }

          if (path.startsWith(token)) {
            nextState.push({
              path: path.slice(token.length), root: node, param: { ...param }
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
            nextState.push({
              path: path.slice(index), root: node, param: newParam
            })
          } else {
            const result = node.expandedFrom.map(p => {
              return { pattern: p, params: newParam }
            })
            results.push(...result)
          }
        }

        for (const [token, node] of Object.entries(root.wildcards)) {
          const nextLiterals = this.collectLiterals(node)
          if (!nextLiterals.length) {
            const newParam = {
              ...param,
              [token]: [...(param[token] ?? []), path]
            }
            const result = node.expandedFrom.map(p => {
              return { pattern: p, params: newParam }
            })
            results.push(...result)
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
                nextState.push({
                  path: nextPath, root: lastNode, param: newParam
                })
              } else {
                const result = lastNode.expandedFrom.map(p => {
                  return { pattern: p, params: newParam }
                })
                results.push(...result)
              }
            }
            // Also check if the wildcard node itself is a terminal (has expandedFrom)
            // This handles cases where the wildcard matches everything
            if (node.expandedFrom.length) {
              const newParam = {
                ...param,
                [token]: [...(param[token] ?? []), path]
              }
              const result = node.expandedFrom.map(p => {
                return { pattern: p, params: newParam }
              })
              results.push(...result)
            }
          }
        }


        for (const [_, node] of Object.entries(root.groups)) {
          nextState.push({
            path: path,
            root: node,
            param: { ...param }
          })
        }
      }
      states = nextState
    }

    return results
  }

  splitPath(pathname: string): string[] {
    const result: string[] = []
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
            result.push(pathname.slice(lower, upper))
          }
          lower = upper
        }
        do {
          upper++
        } while (upper < pathname.length && pathname[upper] !== groupQuotation)
        result.push(pathname.slice(lower, ++upper))
        lower = upper
      } else if (pathname[upper] === groupStart) {
        if (depth === 0) {
          if (pathname.slice(lower, upper)) {
            result.push(pathname.slice(lower, upper))
          }
          lower = upper
        }
        depth++
      } else if (pathname[upper] === groupEnd) {
        depth--
      } else if (depth === 0) {
        if (pathname[upper - 1] === groupEnd) {
          result.push(pathname.slice(lower, upper))
          lower = upper
        }

        if (pathname[upper] === delimiter) {
          if (pathname.slice(lower, upper)) {
            result.push(pathname.slice(lower, upper))
            lower = upper
          }
          result.push(pathname.slice(lower, upper + 1))
          lower = upper + 1
        } else if (pathname[upper] === paramDelimiter || pathname[upper] === wildcardDelimiter) {
          if (pathname.slice(lower, upper)) {
            result.push(pathname.slice(lower, upper))
            lower = upper
          }
        }
      }
      upper++
    }

    upper = Math.min(upper, pathname.length)
    if (lower < upper) {
      result.push(pathname.slice(lower, upper))
    }

    return result
  }

  parsePathTree(pathname: string, parent?: string): Token[] {
    const splitted = this.splitPath(pathname)
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