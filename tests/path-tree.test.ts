import assert from "node:assert"
import { beforeEach, describe, it } from "node:test"
import { PathTree } from "../src/path-tree.ts"

describe("PathTree", () => {
  describe('match', () => {
    let root!: PathTree

    beforeEach(() => {
      root = new PathTree
    })
    it('should return matching pattern', () => {
      root.setPattern("/a/b{/d}/hello")
      root.setPattern("/a/b/:name/hello")
      root.setPattern("/a/b/:name/hello")
      root.setPattern("/a/b/*name/hello")
      root.setPattern("/a/b/*all")
      root.setPattern("/a/b/*all/and/*next")

      const results = new Set(root.match("/a/b/d/hello").map(e => e.pattern))
      assert.ok(results.has("/a/b{/d}/hello"))
      assert.ok(results.has("/a/b/:name/hello"))
      assert.ok(results.has("/a/b/*name/hello"))
      assert.ok(results.has("/a/b/*all"))
    })

    it('should match multiple matching group', () => {
      root.setPattern("/a/b{/d}/hello")
      root.setPattern("/a/b{/:name}/hello")
      root.setPattern("/a/b{/:another}/hello")
      root.setPattern("/a/b/other/hello")

      const results = new Set(root.match("/a/b/d/hello").map(e => e.pattern))
      assert.ok(results.has("/a/b{/d}/hello"), [...results].join(', '))
      assert.ok(results.has("/a/b{/:name}/hello"), [...results].join(', '))
      assert.ok(results.has("/a/b{/:another}/hello"), [...results].join(', '))
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