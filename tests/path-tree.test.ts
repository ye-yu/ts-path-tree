import assert from "node:assert"
import { beforeEach, describe, it } from "node:test"
import { PathTree } from "../src/path-tree.ts"

describe("PathTree", () => {
  describe('pedantic', () => {
    const root = new PathTree()
    root.setPattern('/users/action')
    root.setPattern('/users/action/')
    root.setPattern('users/action')
    root.setPattern('users/action/')

    it('should only match one', () => {
      {
        const matches = root.match('/users/action')
        assert.ok(matches.length === 1)
        assert.equal(matches[0].pattern, '/users/action')
      }
      {
        const matches = root.match('/users/action/')
        assert.ok(matches.length === 1)
        assert.equal(matches[0].pattern, '/users/action/')
      }
      {
        const matches = root.match('users/action')
        assert.ok(matches.length === 1)
        assert.equal(matches[0].pattern, 'users/action')
      }
      {
        const matches = root.match('users/action/')
        assert.ok(matches.length === 1)
        assert.equal(matches[0].pattern, 'users/action/')
      }
    })
  })
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

    it('should reject invalid consecutive params', () => {
      assert.throws(
        () => {
          root.setPattern('/users/:id:action')
        },
        /Unexpected consecutive parameter tokens : :action/
      )
    })

    it('should collect repeated param names as multiple values', () => {
      root.setPattern('/users/:id/follow/:id')

      const [result] = root.match('/users/1/follow/2')
      assert.deepEqual(result.params, { ':id': ['1', '2'] })
    })
  })

  describe('parsePathIntoSegments', () => {
    const root = new PathTree()
    const cases = [
      // new cases added to handle quoted tokens and prefixed quoted tokens
      {
        input: '/api/"hello"',
        expected: ['/', 'api', '/', '"hello"'],
      },
      {
        input: '/api/start"end"next',
        expected: ['/', 'api', '/', 'start', '"end"', 'next'],
      },
      {
        input: '/api/data/:"something"',
        expected: ['/', 'api', '/', 'data', '/', ':"something"'],
      },
      {
        input: '/api/data/*"something"',
        expected: ['/', 'api', '/', 'data', '/', '*"something"'],
      },
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
        const gen = root.splitPath(input)
        const actual = Array.from(gen)
        assert.deepEqual(actual, expected)
      })
    }
  })
})