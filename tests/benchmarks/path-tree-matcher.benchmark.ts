import { PathTree } from "../../src/path-tree.ts";
import { patterns, testInputs } from "./fixtures.ts";

const root = new PathTree()
for (const pattern of patterns) {
    root.setPattern(pattern)
}

for (const { input } of testInputs) {
    const result = root.match(input)
    console.log("Test", input, "got:", JSON.stringify(result, null, 2))
}