# path-tree-matcher

A tiny TypeScript path tree matcher for static routes, optional groups, named parameters, and wildcards.

## Quick usage

```ts
import { PathTree } from "path-tree-matcher"

const tree = new PathTree()

// register patterns
tree.setPattern("/a/b{/d}/hello")
tree.setPattern("/a/b/:name/hello")
tree.setPattern("/a/b/*all")

// match a pathname
const matches = tree.match("/a/b/d/hello")
for (const { pattern, params } of matches) {
  console.log(pattern)
  console.log(params)
}
```

## What these methods do

- `setPattern(pattern, mapper)` registers a route pattern into the tree
- `match(pathname)` returns all matching route results with parameter values

### Example behaviors

- `/a/b{/d}/hello` matches both `/a/b/hello` and `/a/b/d/hello`
- `:name` captures a single named segment
- `*all` captures a wildcard path segment sequence

### Path syntax

- static text: `/users`
- named parameter: `/:id`
- wildcard: `/*rest`
- optional group: `{/segment}`

### Syntax notes
- Invalid consecutive params: `/users/:id:action`
  - unable to split path into two variables: `id`, and `action`
- Repeated variable name: `/users/:id/follow/:id`
  - params[":id"] === [value0, value1]
- Pedantic mode: `/users/action` !== `users/action` !== `users/action/` !== `/users/action/`