import * as child_process from "node:child_process"

export type SerializeableRequestInit = Omit<RequestInit, "headers" | "dispatcher"> & {
    headers?: Record<string, any>
}
export type SerializeableResponse = {
    content: string,
    headers: Record<string, any>
    status: number
    statusText: string
}

export const fetchSync = (url: string, options: SerializeableRequestInit = {}): SerializeableResponse => {
    const result = child_process.spawnSync(
        process.argv[0],
        [
            "-e",
            [
                `await fetch("${url}", ${JSON.stringify(options)})`,
                `.then(async resp => JSON.stringify({ `,
                `content: await resp.text(), `,
                `status: resp.status, `,
                `statusText: resp.statusText, `,
                `headers: Object.fromEntries(resp.headers) `,
                `}))`,
                `.then(console.log)`,
            ].join('')
        ])
    const mapped = result.stdout.toString()
    try {
        const resp = JSON.parse(mapped)
        return resp
    } catch (error) {
        throw new Error("Unable to run sync fetch", { cause: { error, url, resp: mapped } })
    }
}