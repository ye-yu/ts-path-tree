import assert from "node:assert"
import { describe, it } from "node:test"
import { PathTree } from "../src/path-tree.ts"

describe("PathTree", () => {
  describe('match', () => {
    const root = new PathTree<string>()

    root.setPattern("/a/b{/d}/hello", (_, value) => value ?? "hello")
    root.setPattern("/a/b/:name/hello", (_, value) => value ?? "hello from name")
    root.setPattern("/a/b/:name/hello", (_, value) => value ?? "hello from name renamed")
    root.setPattern("/a/b/*name/hello", (_, value) => value ?? "hello from name star")
    root.setPattern("/a/b/*all", (_, value) => value ?? "hello from all")
    root.setPattern("/a/b/*all/and/*next", (_, value) => value ?? "hello from all next")

    it("matches the static route and optional grouped variant", () => {
      const results = root.match("/a/b/hello")
      const values = results.map((result) => result.node.value)

      assert.strictEqual(results.length, 2)
      assert.ok(values.includes("hello"))
      assert.ok(values.includes("hello from all"))

      const helloMatch = results.find((result) => result.node.value === "hello")
      assert.deepStrictEqual(helloMatch?.params, {})
      assert.deepStrictEqual(helloMatch?.segments, ["/", "a", "/", "b", "/", "hello"])

      const allMatch = results.find((result) => result.node.value === "hello from all")
      assert.deepStrictEqual(allMatch?.params, { "*all": ["hello"] })
      assert.deepStrictEqual(allMatch?.segments, ["/", "a", "/", "b", "/", "*all"])
    })

    it("matches the optional grouped route with an inner segment", () => {
      const results = root.match("/a/b/d/hello")
      const values = results.map((result) => result.node.value)

      assert.strictEqual(results.length, 5)
      assert.ok(values.includes("hello"))
      assert.ok(values.includes("hello from all"))
      assert.ok(values.includes("hello from name"))
      assert.ok(values.includes("hello from name star"))

      const helloMatch = results.find((result) => result.node.value === "hello")
      assert.deepStrictEqual(helloMatch?.params, {})
      assert.deepStrictEqual(helloMatch?.segments, ["/", "a", "/", "b", "/", "d", "/", "hello"])

      const allMatch = results.find(
        (result) => result.node.value === "hello from all" && result.params["*all"]?.join("") === "d/hello"
      )
      assert.deepStrictEqual(allMatch?.params, { "*all": ["d", "/", "hello"] })
      assert.deepStrictEqual(allMatch?.segments, ["/", "a", "/", "b", "/", "*all"])

      const nameParam = results.find((result) => result.node.value === "hello from name")
      assert.deepStrictEqual(nameParam?.params, { ":name": ["d"] })
      assert.deepStrictEqual(nameParam?.segments, ["/", "a", "/", "b", "/", ":name", "/", "hello"])

      const nameWildcard = results.find((result) => result.node.value === "hello from name star")
      assert.deepStrictEqual(nameWildcard?.params, { "*name": ["d"] })
      assert.deepStrictEqual(nameWildcard?.segments, ["/", "a", "/", "b", "/", "*name", "/", "hello"])
    })

    it("matches named parameter and wildcard routes", () => {
      const results = root.match("/a/b/name/hello")
      const values = results.map((result) => result.node.value)

      assert.strictEqual(results.length, 3)
      assert.ok(values.includes("hello from name"))
      assert.ok(values.includes("hello from name star"))
      assert.ok(values.includes("hello from all"))

      const nameParam = results.find((result) => result.node.value === "hello from name")
      assert.deepStrictEqual(nameParam?.params, { ":name": ["name"] })
      assert.deepStrictEqual(nameParam?.segments, ["/", "a", "/", "b", "/", ":name", "/", "hello"])

      const nameWildcard = results.find((result) => result.node.value === "hello from name star")
      assert.deepStrictEqual(nameWildcard?.params, { "*name": ["name"] })
      assert.deepStrictEqual(nameWildcard?.segments, ["/", "a", "/", "b", "/", "*name", "/", "hello"])

      const allMatch = results.find((result) => result.node.value === "hello from all")
      assert.deepStrictEqual(allMatch?.params, { "*all": ["name", "/", "hello"] })
      assert.deepStrictEqual(allMatch?.segments, ["/", "a", "/", "b", "/", "*all"])
    })

    it("matches deeper wildcard paths", () => {
      const results = root.match("/a/b/name/deep/hello")
      const values = results.map((result) => result.node.value)

      assert.strictEqual(results.length, 2)
      assert.ok(values.includes("hello from all"))
      assert.ok(values.includes("hello from name star"))

      const nameWildcard = results.find((result) => result.node.value === "hello from name star")
      assert.deepStrictEqual(nameWildcard?.params, { "*name": ["name", "/", "deep"] })
      assert.deepStrictEqual(nameWildcard?.segments, ["/", "a", "/", "b", "/", "*name", "/", "hello"])
    })

    it("matches nested wildcard route with tail segments", () => {
      const results = root.match("/a/b/name/deep/something/and/hello/again")
      const values = results.map((result) => result.node.value)

      assert.strictEqual(results.length, 2)
      assert.ok(values.includes("hello from all"))
      assert.ok(values.includes("hello from all next"))

      const allNext = results.find((result) => result.node.value === "hello from all next")
      assert.deepStrictEqual(allNext?.params, {
        "*all": ["name", "/", "deep", "/", "something"],
        "*next": ["hello", "/", "again"],
      })
      assert.deepStrictEqual(allNext?.segments, ["/", "a", "/", "b", "/", "*all", "/", "and", "/", "*next"])

      const allMatch = results.find((result) => result.node.value === "hello from all")
      assert.deepStrictEqual(allMatch?.params, {
        "*all": ["name", "/", "deep", "/", "something", "/", "and", "/", "hello", "/", "again"],
      })
      assert.deepStrictEqual(allMatch?.segments, ["/", "a", "/", "b", "/", "*all"])
    })

    it("does not match a non-existent route", () => {
      const results = root.match("/a/bc/hello")
      assert.strictEqual(results.length, 0)
    })
  })

  describe('matchPattern', () => {
    const root = new PathTree<string>()

    root.setPattern("/a/b{/d}/hello", (_, value) => value ?? "hello")
    root.setPattern("/a/b/:name/hello", (_, value) => value ?? "hello from name")
    root.setPattern("/a/b/:name/hello", (_, value) => value ?? "hello from name renamed")
    root.setPattern("/a/b/*name/hello", (_, value) => value ?? "hello from name star")
    root.setPattern("/a/b/*all", (_, value) => value ?? "hello from all")
    root.setPattern("/a/b/*all/and/*next", (_, value) => value ?? "hello from all next")

    it('should return matching pattern', () => {
      const results = root.matchPattern("/a/b/d/hello")
      assert.ok(results.has("/a/b{/d}/hello"))
      assert.ok(results.has("/a/b/:name/hello"))
      assert.ok(results.has("/a/b/*name/hello"))
      assert.ok(results.has("/a/b/*all"))
    })
  })

  describe('parsePathIntoSegments', () => {
    const root = new PathTree()
    const cases = [
      {
        input: '/api/:param',
        expected: ['/', 'api', '/', ':param'],
      },
      {
        input: '/api/:param:next',
        expected: ['/', 'api', '/', ':param', ':next'],
      },
      {
        input: '/api/{:param}',
        expected: ['/', 'api', '/', '{:param}'],
      },
      {
        input: '/api/*param',
        expected: ['/', 'api', '/', '*param'],
      },
      {
        input: '/api/*param*next',
        expected: ['/', 'api', '/', '*param', '*next'],
      },
      {
        input: '/api/{*param}',
        expected: ['/', 'api', '/', '{*param}'],
      },
      {
        input: '/api/{*param}:next',
        expected: ['/', 'api', '/', '{*param}', ':next'],
      },
      {
        input: '/api/:param*next',
        expected: ['/', 'api', '/', ':param', '*next'],
      },
      {
        input: '/api/{*param}:next',
        expected: ['/', 'api', '/', '{*param}', ':next'],
      },
      //
      {
        input: '/api/:param/end',
        expected: ['/', 'api', '/', ':param', '/', 'end'],
      },
      {
        input: '/api/:param:next/end',
        expected: ['/', 'api', '/', ':param', ':next', '/', 'end'],
      },
      {
        input: '/api/{:param}/end',
        expected: ['/', 'api', '/', '{:param}', '/', 'end'],
      },
      {
        input: '/api/*param/end',
        expected: ['/', 'api', '/', '*param', '/', 'end'],
      },
      {
        input: '/api/*param*next/end',
        expected: ['/', 'api', '/', '*param', '*next', '/', 'end'],
      },
      {
        input: '/api/{*param}/end',
        expected: ['/', 'api', '/', '{*param}', '/', 'end'],
      },
      {
        input: '/api/{*param}:next/end',
        expected: ['/', 'api', '/', '{*param}', ':next', '/', 'end'],
      },
      {
        input: '/api/:param*next/end',
        expected: ['/', 'api', '/', ':param', '*next', '/', 'end'],
      },
      {
        input: '/api/{*param}:next/end',
        expected: ['/', 'api', '/', '{*param}', ':next', '/', 'end'],
      },
      //
      {
        input: '/api/:param/',
        expected: ['/', 'api', '/', ':param', '/'],
      },
      {
        input: '/api/:param:next/',
        expected: ['/', 'api', '/', ':param', ':next', '/'],
      },
      {
        input: '/api/{:param}/',
        expected: ['/', 'api', '/', '{:param}', '/'],
      },
      {
        input: '/api/*param/',
        expected: ['/', 'api', '/', '*param', '/'],
      },
      {
        input: '/api/*param*next/',
        expected: ['/', 'api', '/', '*param', '*next', '/'],
      },
      {
        input: '/api/{*param}/',
        expected: ['/', 'api', '/', '{*param}', '/'],
      },
      {
        input: '/api/{*param}:next/',
        expected: ['/', 'api', '/', '{*param}', ':next', '/'],
      },
      {
        input: '/api/:param*next/',
        expected: ['/', 'api', '/', ':param', '*next', '/'],
      },
      {
        input: '/api/{*param}:next/',
        expected: ['/', 'api', '/', '{*param}', ':next', '/'],
      },
    ]

    for (const { input, expected } of cases) {
      it(`should parse ${input}`, () => {
        const gen = root.parsePathIntoSegments(input)
        const actual = Array.from(gen)
        assert.deepEqual(actual, expected)
      })
    }
  })
})