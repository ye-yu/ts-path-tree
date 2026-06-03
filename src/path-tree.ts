type ExpandResult<T> = { segments: string[], node: PathNode<T> }
type TraverseResult<T> = { params: Record<string, string[]>, segments: string[], node: PathNode<T> }
type PrintResult<T> = { segments: string[], indent: number, pattern: string, value: T | null | undefined, id: string }
export type Token =
  | { param: string, token: "param" | "wildcard" }
  | { value: string, token: "group", groups: Token[] }
  | { value: string, token: "text" }
export type TokenType = Token["token"]

class DefaultedMap<K, V> extends Map<K, V> {
  readonly defaultValue: (key: K) => V

  constructor(defaultValue: (key: K) => V) {
    super()
    this.defaultValue = defaultValue
  }

  get(key: K): V {
    if (!this.has(key)) {
      const value = this.defaultValue(key)
      this.set(key, value)
      return value
    }
    return super.get(key)!
  }

  merge(map: Map<K, V>): void {
    for (const [key, value] of map) {
      this.set(key, value)
    }
  }
}

export class PathNode<V> {
  readonly children: DefaultedMap<string, PathNode<V>>;
  readonly childrenOfParams: DefaultedMap<string, PathNode<V>>;
  readonly childrenOfWildcards: DefaultedMap<string, PathNode<V>>;
  name: string
  parent?: PathNode<V>
  value?: V
  wildcard?: boolean
  param?: boolean
  expandedFrom?: string

  constructor(name: string, parent?: PathNode<V>) {
    this.name = name
    this.parent = parent
    this.children = new DefaultedMap((key) => new PathNode<V>(key, this))
    this.childrenOfParams = new DefaultedMap((key) => new PathNode<V>(key, this))
    this.childrenOfWildcards = new DefaultedMap((key) => new PathNode<V>(key, this))
  }

  addNextOfParam(name: string, node: PathNode<V>): void {
    this.childrenOfParams.set(name, node)
  }

  addNextOfWildcard(name: string, node: PathNode<V>): void {
    this.childrenOfWildcards.set(name, node)
  }
}

export class PathTree<T> {
  root = new PathNode<T>("")

  expand<V = T>(root: PathNode<V>, pattern: string): ExpandResult<V>[] {
    const tokens = this.parsePathTree(pattern)
    const nodes: ExpandResult<V>[] = [{ segments: [], node: root }]
    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t]
      const tokenType = token.token
      if (tokenType === "group") {
        const currentNodeLength = nodes.length
        for (let i = 0; i < currentNodeLength; i++) {
          const node = nodes[i]
          const flatten = this.expand(node.node, token.value)
          const newNodes = flatten.map((f) => ({
            segments: [...node.segments, ...flatten.flatMap(e => e.segments)],
            node: f.node,
          }))
          nodes.push(...newNodes)
        }
        continue
      }
      switch (tokenType) {
        case "text": {
          let nextNodeToLink: PathNode<V> | undefined = undefined
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i]
            nextNodeToLink ??= node.node.children.get(token.value)
            node.node.children.set(token.value, nextNodeToLink)
            nodes[i] = {
              segments: [...node.segments, token.value],
              node: nextNodeToLink,
            }
          }
          break
        }
        case "wildcard":
        case "param": {
          let nextNodeToLink: PathNode<V> | undefined = undefined
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i]
            const children = tokenType === "wildcard" ? node.node.childrenOfWildcards : node.node.childrenOfParams
            nextNodeToLink ??= children.get(token.param)
            children.set(token.param, nextNodeToLink)

            const nextNode = nextNodeToLink
            nextNode.param = true

            if (tokenType === "param") {
              node.node.addNextOfParam(token.param, nextNode)
            } else if (tokenType === "wildcard") {
              node.node.addNextOfWildcard(token.param, nextNode)
              nextNode.wildcard = true
            }

            // overwrite position
            nodes[i] = { segments: [...node.segments, token.param], node: nextNode }
          }
          break
        }
      }
    }

    for (const { node } of nodes) {
      node.expandedFrom = pattern
    }
    return nodes
  }

  setPattern(pattern: string, mapper: (segments: string[], value?: T) => T): void {
    const nodes = this.expand(this.root, pattern)
    for (const { node, segments } of nodes) {
      node.value = mapper(segments, node.value)
    }
  }

  match(pathname: string): TraverseResult<T>[] {
    let nodes = [{
      needles: [...this.parsePathIntoSegments(pathname)],
      segments: [] as string[],
      params: {} as Record<string, string[]>,
      node: this.root
    }]
    let iterateNext: typeof nodes = []
    const matched: TraverseResult<T>[] = []
    while (nodes.length) {
      iterateNext = []
      for (const { needles, params, node, segments } of nodes) {
        for (const paramNode of node.childrenOfParams.values()) {
          const newParams = { ...params }
          newParams[paramNode.name] = [needles[0]]
          if (needles.length === 1 && paramNode.value !== undefined) {
            matched.push({
              params: newParams,
              segments: [...segments],
              node: paramNode,
            })
            continue
          }
          iterateNext.push({
            needles: [...needles].slice(1),
            segments: [...segments, paramNode.name],
            params: newParams,
            node: paramNode,
          })
        }

        for (const wildcardNode of node.childrenOfWildcards.values()) {

          // for path without next segment, we match the whole node
          if (wildcardNode.value !== undefined) {
            matched.push({
              params: { ...params, [wildcardNode.name]: [...needles] },
              segments: [...segments],
              node: wildcardNode,
            })
          }

          // check for next segment,
          if (!wildcardNode.children.has('/')) continue
          const wildNeedles = [...needles]
          const newParams = { ...params }
          const wildcardRoot = wildcardNode.children.get('/')
          newParams[wildcardNode.name] = [wildNeedles.shift()!].filter(Boolean)
          while (wildNeedles.length) {
            const segment = wildNeedles[0]
            // child is found, need to stop here and try match the rest of the segments with the child
            if (segment !== '/' && wildcardRoot.children.has(segment)) break
            if (segment === '/') {
              wildNeedles.shift();
              continue;
            }
            newParams[wildcardNode.name].push('/', wildNeedles.shift()!)
          }

          if (wildNeedles.length && wildcardRoot.children.size) {
            // still has children, try match the rest of the segments
            iterateNext.push({
              needles: ['/', ...wildNeedles],
              params: newParams,
              segments: [...segments, wildcardNode.name],
              node: wildcardNode,
            })
            continue
          }

          if (wildcardNode.value === undefined) continue

          if (!wildNeedles.length && !wildcardRoot.children.size) {
            // segments exhausted and no more children,
            matched.push({
              params: newParams,
              segments: [...segments, wildcardNode.name],
              node: wildcardRoot,
            })
          }
        }

        if (!node.children.has(needles[0])) continue

        const childNode = node.children.get(needles[0])
        if (childNode.param) continue
        if (needles.length > 1) {
          iterateNext.push({
            needles: [...needles].slice(1),
            params,
            segments: [...segments, needles[0]],
            node: childNode,
          })
          continue
        }
        if (childNode.value === undefined) continue
        // exact match is found
        matched.push({ params, segments, node: childNode })
      }
      nodes = iterateNext
    }

    return matched.map(e => ({ ...e, segments: [...e.segments, e.node.name] }))
  }

  matchPattern(pathname: string): Set<string> {
    const matches = this.match(pathname)
    const filtered = matches.map(e => e.node.expandedFrom ?? '').filter(e => e)
    return new Set(filtered)
  }

  *printTreeIterator(recursed?: {
    root: PathNode<T>,
    indent: number,
    seen: Set<PathNode<T>>,
    map: Map<any, number>,
    counter: { id: number }
  }): Generator<PrintResult<T>> {
    let root = recursed?.root ?? this.root
    const indent = recursed?.indent ?? 0
    const seen = recursed?.seen ?? new Set
    const map = recursed?.map ?? new Map
    const counter = recursed?.counter ?? { id: 0 }

    let segments = [root.name]
    let oneChild = [...root.children.values(), ...root.childrenOfParams.values(), ...root.childrenOfWildcards.values()]
    while (oneChild.length === 1 && (root.value === undefined || root.value === null)) {
      seen.add(root)
      root = oneChild[0]
      oneChild = [...root.children.values(), ...root.childrenOfParams.values(), ...root.childrenOfWildcards.values()]
      segments.push(root.name)
    }

    let valueId = ""
    if (root.value === undefined) {
      valueId = "und"
    } else if (root.value === null) {
      valueId = "null"
    } else if (map.has(root.value)) {
      valueId = `${map.get(root.value)}`
    } else {
      valueId = `${++counter.id}`
      map.set(root.value, counter.id)
    }

    yield {
      id: valueId,
      indent,
      segments,
      pattern: segments.join(''),
      value: root.value
    }
    if (!oneChild.length) {
      return
    }

    for (const child of [...root.children.values(), ...root.childrenOfParams.values(), ...root.childrenOfWildcards.values()]) {
      if (seen.has(child)) continue
      yield* this.printTreeIterator({
        root: child,
        indent: indent + 2,
        seen,
        map,
        counter
      })
    }
  }

  printTree() {
    for (const node of this.printTreeIterator()) {
      console.log(' '.repeat(node.indent), '- ', node.pattern, '=>', node.value, `<id: ${node.id}>`)
    }
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

    while (upper < pathname.length) {
      if (pathname[upper] === groupStart) {
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
        matched.push({ value: group, token: "group", groups: this.parsePathTree(group, parent ?? pathname) })
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

        matched.push({ token: "param", param: split })
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
        matched.push({ token: "wildcard", param: `*${wildcard}` })
        continue
      }

      matched.push({ value: split, token: "text" })
    }
    return matched
  }
}