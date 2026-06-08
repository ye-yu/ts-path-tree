import { beforeEach, describe, it } from "node:test"
import assert from "node:assert"
import * as cases from "path-to-regexp/cases.spec"
import { PathTree } from "../src/index.ts";

describe("MATCH_TESTS", () => {
  for (const suite of cases.MATCH_TESTS) {
    const name = Array.isArray(suite.path) ? suite.path.map(e => typeof e === "string" ? e : e.originalPath).join(", ") : suite.path
    const nameAsString = typeof name === "string" ? name : name.originalPath
    describe(nameAsString,
      { skip: suite.options ? `options from path-to-regexp is not supported yet` : false },
      () => {
        let root!: PathTree
        beforeEach(() => {
          root = new PathTree()
          root.strict = false
          if (Array.isArray(suite.path)) {
            for (const path of suite.path) {
              if (typeof path === "string") {
                root.setPattern(path)
              } else if (path.originalPath) {
                root.setPattern(path.originalPath)
              }
            }
          } else {
            const path = suite.path
            if (typeof path === "string") {
              root.setPattern(path)
            } else if (path.originalPath) {
              root.setPattern(path.originalPath)
            }
          }
        })

        for (const unit of suite.tests) {
          it(`should parse ${unit.input}`, () => {
            const result = root.match(unit.input)
            if (unit.expected === false) {
              assert.ok(result.length === 0)
            } else {
              const resultParams = [] as Record<string, string[]>[]
              for (const { params } of result) {
                const newParams = {} as Record<string, string[]>
                for (const [key, value] of Object.entries(params)) {
                  newParams[key.slice(1)] = value
                }
                resultParams.push(newParams)
              }

              if (unit.expected.params) {
                const expected = {} as Record<string, string[]>
                for (const [key, value] of Object.entries(unit.expected.params)) {
                  if (value === undefined) {
                    expected[key] = []
                  } else if (typeof value === "string") {
                    expected[key] = [value]
                  } else if (Array.isArray(value)) {
                    expected[key] = [value.join('/')]
                  }
                }
                someMatch(expected, resultParams)
              } else {
                someMatch({}, resultParams)
              }
            }
          })
        }
      })
  }
})

function someMatch(expected: any, candidates: any[]) {
  const firstMatch = candidates.find(e => {
    try {
      assert.deepEqual(expected, e)
      return true
    } catch (_ignored) { return false }
  })

  assert.ok(firstMatch, new Error(`Cannot find ${JSON.stringify(expected)} in ${JSON.stringify(candidates)}`))
}