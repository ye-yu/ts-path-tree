import path from "path"
import fs from "fs"
import os from "os"
import { fetchSync, type SerializeableRequestInit, type SerializeableResponse } from "./sync-fetch.ts";

const tmpDir = os.tmpdir()
const etagStoragePath = path.join(tmpDir, "etags.json")

type Etag = SerializeableResponse & {
    tag: string,
}

export const cachedFetch = (url: string, init: SerializeableRequestInit = {}): SerializeableResponse => {
    let loadedEtags: Record<string, Etag> = {}
    try {
        const etagData = fs.readFileSync(etagStoragePath, "utf-8")
        loadedEtags = JSON.parse(etagData)
    } catch (error) {
        // Ignore JSON parse errors
    }

    const etag = loadedEtags[`${url}`]
    const headers = init?.headers ?? {}
    if (etag) {
        headers["If-None-Match"] = etag.tag
    }
    const resp = fetchSync(url, {
        ...init,
        headers
    })

    if (resp.status === 304) {
        // Not modified, use cached content
        return etag
    }

    const respEtag = resp.headers["ETag"]
    if (respEtag) {
        loadedEtags[`${url}`] = {
            tag: JSON.stringify(respEtag),
            content: resp.content,
            status: resp.status,
            statusText: resp.statusText,
            headers: resp.headers
        }
        fs.writeFileSync(etagStoragePath, JSON.stringify(loadedEtags))
    }

    return resp
}
