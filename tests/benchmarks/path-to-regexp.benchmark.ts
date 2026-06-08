import { patterns, testInputs } from "./fixtures.ts";
import * as pathToRegexp from 'path-to-regexp'
import * as cases from "path-to-regexp/cases.spec"

console.log(cases.MATCH_TESTS, cases.PARSER_TESTS)

const matchPath = patterns.map(e => ({ pattern: e, matcher: pathToRegexp.match(e) }))

function findMatching(path: string): { pattern: string, params: Record<string, any> }[] {
    return matchPath.flatMap(e => {
        const result = e.matcher(path)
        if (!result) return []
        return [{ pattern: e.pattern, params: result.params }]
    })
}

for (const { input } of testInputs) {
    console.log("Test", input, "got:", JSON.stringify(findMatching(input), null, 2))
}