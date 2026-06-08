import * as module from "module"
import { cachedFetch } from "../cached-fetch.ts";

const importMap: Record<string, { url: string, format: string, postprocess?: (content: string) => string }> = {
    "path-to-regexp": {
        url: "https://cdn.jsdelivr.net/npm/path-to-regexp@8.4.2/dist/index.js",
        format: "commonjs",
        postprocess: (content) => `${content}\nexports.Path=void 0;`
    },
    "path-to-regexp/cases.spec": {
        url: "https://raw.githubusercontent.com/pillarjs/path-to-regexp/refs/heads/master/src/cases.spec.ts",
        format: "module-typescript"
    },
    "https://raw.githubusercontent.com/pillarjs/path-to-regexp/refs/heads/master/src/cases.spec.ts:./index.js": {
        url: "https://cdn.jsdelivr.net/npm/path-to-regexp@8.4.2/dist/index.js",
        format: "commonjs",
        postprocess: (content) => `${content}\nexports.Path=void 0;`
    },
}

const shouldFetch = new Set<string>()


module.registerHooks({
    resolve(specifier, context, next) {
        const rawSpec = specifier
        const relativeSpec = context.parentURL ? `${context.parentURL}:${specifier}` : null
        const resolvedImportMap = importMap[rawSpec] ?? (relativeSpec ? importMap[relativeSpec] : null)
        if (resolvedImportMap) {
            shouldFetch.add(resolvedImportMap.url)
            return {
                ...resolvedImportMap,
                shortCircuit: true,
                importAttributes: {
                    loader: "https",
                    specifier: relativeSpec ?? rawSpec,
                }
            }
        }
        return next(specifier, context)
    },
    load(url, context, next) {
        if (!shouldFetch.has(url)) return next(url, context);

        const specifier = context.importAttributes.specifier

        const fetched = cachedFetch(url)
        const processed = !specifier ? fetched.content : importMap[specifier]?.postprocess?.(fetched.content) ?? fetched.content

        return {
            format: context.format,
            source: processed,
            shortCircuit: true,
        }
    }
})