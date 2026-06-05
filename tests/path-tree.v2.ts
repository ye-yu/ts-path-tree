import { PathTree } from '../src/path-tree.ts';

class MetaString<T extends object> extends String {
    meta: T;
    constructor(...args: any[]) {
        super(...args);
        this.meta = {} as T;
    }
}

class MetaPath extends MetaString<{ original: string, params: Record<string, string[]> }> { }

type PathNode = {
    literals: Record<string, PathNode>,
    params: Record<string, PathNode>,
    wildcards: Record<string, PathNode>,
    groups: Record<string, PathNode>,
    expandedFrom: string[],
}

function newNode(): PathNode {
    return {
        literals: {},
        params: {},
        wildcards: {},
        groups: {},
        expandedFrom: [],
    }
}

const root: PathNode = newNode()

const parsePathTreeV2 = PathTree.prototype.parsePathTreeV2.bind(PathTree.prototype)

const patterns = [
    "/api/v1/*all",
    "/api/v1{/:types}/:id",
    "/api/v1{/:actions}/:id",
    "/api/v1/files/*paths",
    "/api/v1/health",
    "/api/v2/health",
]

function insertPath(node: PathNode, path: string, expandedFrom?: string) {
    if (!path) {
        throw new Error("Path cannot be empty")
    }
    const tokens = parsePathTreeV2(path)
    let currentNode = node
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i]
        currentNode[`${token.type}s`][token.token] ??= newNode()
        switch (token.type) {
            case "literal": {
                currentNode = currentNode.literals[token.token]
                break
            }
            case "param": {
                if (token.token.length < 2) {
                    throw new Error(`Parameter token ${token.token} is too short in path ${path}`)
                }

                if (tokens[i - 1]?.type === "param" || tokens[i - 1]?.type === "wildcard") {
                    throw new Error(`Unexpected consecutive parameter tokens : ${token.token} in path ${path}`)
                }

                currentNode = currentNode.params[token.token]
                break
            }
            case "wildcard": {
                if (token.token.length < 2) {
                    throw new Error(`Parameter token ${token.token} is too short in path ${path}`)
                }

                if (tokens[i - 1]?.type === "param" || tokens[i - 1]?.type === "wildcard") {
                    throw new Error(`Unexpected consecutive parameter tokens : ${token.token} in path ${path}`)
                }

                currentNode = currentNode.wildcards[token.token]
                break
            }
            case "group": {
                insertPath(currentNode.groups[token.token], token.token.slice(1, -1), expandedFrom ?? path)
                break
            }
        }
    }
    currentNode.expandedFrom.push(expandedFrom ?? path)
}

function* match(root: PathNode, path: string, param: Record<string, string[]> = {}): Generator<MetaPath> {
    for (const [token, node] of Object.entries(root.literals)) {
        if (path.startsWith(token)) {
            yield* match(node, path.slice(token.length), { ...param })
        }
    }

    for (const [token, node] of Object.entries(root.params)) {
        // must only match literal of '/' next
        const indexOfSlash = path.indexOf("/")
        const index = indexOfSlash === -1 ? path.length : indexOfSlash
        const paramValue = path.slice(0, index)
        const newParam = {
            ...param,
            [token]: [...(param[token] ?? []), paramValue]
        }
        yield* match(node.literals['/'] ?? newNode(), path.slice(index), newParam)
        yield* node.expandedFrom.map(p => {
            const metaPath = new MetaPath(p)
            metaPath.meta.original = p
            metaPath.meta.params = param
            return metaPath
        })
    }

    for (const [token, node] of Object.entries(root.wildcards)) {
        // must match literal next
        for (const [nextToken, nextNode] of Object.entries(node.literals)) {
            const index = path.indexOf(nextToken)
            if (index === -1) continue
            const paramValue = path.slice(0, index)
            const newParam = {
                ...param,
                [token]: [...(param[token] ?? []), paramValue]
            }
            yield* match(nextNode, path.slice(index), newParam)
        }
        // else match the rest of the path
        yield* node.expandedFrom.map(p => {
            const metaPath = new MetaPath(p)
            metaPath.meta.original = p
            metaPath.meta.params = param
            return metaPath
        })
    }

    for (const [token, node] of Object.entries(root.groups)) {
        yield* match(node, path, { ...param })
    }


    yield* root.expandedFrom.map(p => {
        const metaPath = new MetaPath(p)
        metaPath.meta.original = p
        metaPath.meta.params = param
        return metaPath
    })
}

for (const pattern of patterns) {
    insertPath(root, pattern)
}
// console.log(JSON.stringify(root, null, 2))

const testPaths = [
    // "/api/v1/health",
    // "/api/v2/health",
    "/api/v1/files/path/to/file",
    // "/api/v1/users/123",
    // "/api/v1/posts/456",
    // "/api/v1/comments/789",
]

for (const testPath of testPaths) {
    console.log(`Matching path: ${testPath}`)
    const matches = [...match(root, testPath)]
    for (const match of matches) {
        console.log(`Matched pattern: ${match}, params: ${JSON.stringify(match.meta.params)}`)
    }
    console.log("-----")
}