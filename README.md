# path-tree

A tiny TypeScript path tree matcher for static routes, optional groups, named parameters, and wildcards.

## Quick usage

```ts
import { PathTree } from "ts-path-tree"

const tree = new PathTree<string>()

// register patterns
tree.setPattern("/a/b{/d}/hello", (_, value) => value ?? "hello")
tree.setPattern("/a/b/:name/hello", (_, value) => value ?? "hello from name")
tree.setPattern("/a/b/*all", (_, value) => value ?? "hello from all")

// match a pathname
const matches = tree.match("/a/b/d/hello")
for (const { node, params, segments } of matches) {
  console.log(node.value)
  console.log(params)
  console.log(segments)
}

// get the matching pattern strings
const patterns = tree.matchPattern("/a/b/d/hello")
console.log([...patterns])
```

## What these methods do

- `setPattern(pattern, mapper)` registers a route pattern and stores a value via the mapper callback.
- `match(pathname)` returns all matching route results, including parameter values and route segments.
- `matchPattern(pathname)` returns a `Set<string>` of the original pattern strings that matched.

### Example behaviors

- `/a/b{/d}/hello` matches both `/a/b/hello` and `/a/b/d/hello`
- `:name` captures a single named segment
- `*all` captures a wildcard path segment sequence

## Appendix — API overview

- `new PathTree<T>()`
- `setPattern(pattern: string, mapper: (segments: string[], value?: T) => T): void`
- `match(pathname: string): TraverseResult<T>[]`
- `matchPattern(pathname: string): Set<string>`
- `printTree(): void`

### Path syntax

- static text: `/users`
- named parameter: `/:id`
- wildcard: `/*rest`
- optional group: `{/segment}`
