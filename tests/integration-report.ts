import assert from "node:assert"
import * as fs from "node:fs"
import * as path from "node:path"
import * as cases from "path-to-regexp/cases.spec"
import { PathTree } from "../src/index.ts";
import { fileURLToPath } from "node:url";

const filePath = fileURLToPath(import.meta.url)
const dirname = path.dirname(filePath)
const logPath = path.join(dirname, '..', 'logs', 'path-to-regexp-compat-result.md')

type Result = {
  pattern: string,
  input: string,
  expected: string,
  actual: string,
  passed: string,
}

function getPatterns(matchPattern: cases.MatchTestSet["path"]): string[] {
  const result: string[] = []
  if (Array.isArray(matchPattern)) {
    for (const path of matchPattern) {
      if (typeof path === "string") {
        result.push(path)
      } else if (path.originalPath) {
        result.push(path.originalPath)
      }
    }
  } else {
    const path = matchPattern
    if (typeof path === "string") {
      result.push(path)
    } else if (path.originalPath) {
      result.push(path.originalPath)
    }
  }

  return result
}

const results = cases.MATCH_TESTS.flatMap((suite) => {
  const patterns = getPatterns(suite.path)
  try {
    if (suite.options) {
      throw new Error('path-to-regexp options is not yet supported in this test')
    }
    const root = new PathTree()
    for (const pattern of patterns) {
      root.setPattern(pattern)
    }

    return suite.tests.map((unit) => {
      const result = root.match(unit.input)

      const resultParams = [] as Record<string, string[]>[]
      for (const { params } of result) {
        const newParams = {} as Record<string, string[]>
        for (const [key, value] of Object.entries(params)) {
          newParams[key.slice(1)] = value
        }
        resultParams.push(newParams)
      }

      let passed = "FAILED"

      if (!unit.expected) {
        passed = resultParams.length === 0 ? "PASSED" : "FAILED"
      } else if (unit.expected.params) {
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
        const hasMatch = someMatch(expected, resultParams)
        passed = hasMatch ? "PASSED" : "FAILED"
      } else {
        const hasMatch = someMatch({}, resultParams)
        passed = hasMatch ? "PASSED" : "FAILED"
      }

      return {
        pattern: patterns.length > 1 ? patterns.map(e => `  ${e}`).join('\n') : patterns[0],
        input: unit.input,
        expected: JSON.stringify(unit.expected),
        actual: JSON.stringify(resultParams),
        passed: passed
      } satisfies Result
    })

  } catch (error: any) {
    return suite.tests.map((unit) => {
      return {
        pattern: patterns.length > 1 ? patterns.map(e => `  ${e}`).join('\n') : patterns[0],
        input: unit.input,
        expected: unit.expected ? JSON.stringify(unit.expected.params) : "",
        actual: `${error?.message}`.replaceAll(/\n/g, ' '),
        passed: "ERROR"
      } satisfies Result
    })
  }
})

const regressionResult = results.filter(e => e.passed === "PASSED").length / results.length


const percentageFormatter = new Intl.NumberFormat("en-US", {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const compatPercent = percentageFormatter.format(regressionResult)

fs.writeFileSync(logPath, [
  `# path-to-regexp compat table`,
  '',
  `- API compabitility result: ${compatPercent}`,
  ``,
  `### Spec results`,
  '| Pattern | Input | Expected | Actual | Passed |',
  '|---------|-------|----------|--------|--------|',
  ...results.toSorted((a, b) => {
    const aPassed = a.passed === "PASSED" ? 1 : 0;
    const bPassed = b.passed === "PASSED" ? 1 : 0;
    return bPassed - aPassed
  }).map(e => `| \`${e.pattern}\` | \`${e.input}\` | \`${e.expected}\` | \`${e.actual}\` | **${e.passed}** |`)
].join('\n'))

function someMatch(expected: any, candidates: any[]) {
  return candidates.find(e => {
    try {
      assert.deepEqual(expected, e)
      return true
    } catch (_ignored) { return false }
  })
}