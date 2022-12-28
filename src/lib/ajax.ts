/* eslint-disable no-await-in-loop */
import { GM } from "$";

/**
 * Subclass of Map which automatically deletes values after
 * the given time of non-using
 */
class TemporalMap<K = any, V = any> extends Map<K, V> {
    #timeout = 1000;
    #removing = new Map<K, NodeJS.Timer>();

    /**
     * @param timeout - time before removing the values
     */
    constructor (timeout?: number);
    /**
     * @param values - optional initial values of the map
     * @param timeout - delay of deletion in ms, default - 1 second
     */
    constructor (values?: readonly (readonly [K, V])[], timeout?: number);

    constructor (values?: readonly (readonly [K, V])[] | number, timeout?: number) {
        if (timeout === undefined && typeof values === "number") {
            timeout = values;
            values = undefined;
        }
        // @ts-ignore - ts is don't see constructor params :(
        super(values ?? null);
        if (timeout) this.#timeout = timeout;
    }

    /**
     * Schedules deletion of the value
     * @param key - the value's key
     * @returns whether the values is/will be deleted
     */
    delete (key: K): boolean {
        if (!this.has(key)) return false;
        super.delete(key);
        if (this.#removing.has(key)) {
            clearTimeout(this.#removing.get(key));
            this.#removing.delete(key);
        }
        return true;
    }

    /**
     * Schedule deletion of all the values
     */
    clear (): void {
        super.clear();
        for (const id of this.#removing.values()) {
            clearTimeout(id);
        }
        this.#removing.clear();
    }

    /**
     * Retrieves a value by the key and cancels its deletion
     * @param key - the value's key
     */
    set (key: K, value: V) {
        super.set(key, value);
        if (this.#removing.has(key)) {
            clearTimeout(this.#removing.get(key));
        }
        this.#removing.set(key, setTimeout(() => {
            this.delete(key);
            this.#removing.delete(key);
        }, this.#timeout));
        return this;
    }
}

type Params = Record<string, string|number>;

type FetchFunc = (url: string, params: RequestInit) => Promise<Response>;

const sleep = (time: number) => new Promise<void>((resolve) => { setTimeout(resolve, time); });

/**
 * A fetch-like function that works over GM.XHR
 * @param {string} url - Full URL of the request
 * @param {RequestInit} params - Other params of the function
 * @returns {Promise<Response>} Response object of the same type as fetch's
 */
function gmFetch (url: string, params: RequestInit = {}) {
    return new Promise<Response>((res, rej) => {
        GM.xmlHttpRequest({
            url,
            method: (params.method ?? "GET") as "GET" | "HEAD" | "POST",
            data: params.body as string | FormData | undefined,
            binary: !!params.body,
            nocache: true, // do not cache reponses, especially bad ones
            responseType: "arraybuffer",
            onload (resp) {
                res(new Response(resp.response, {
                    status: resp.status,
                    statusText: resp.statusText,
                    headers: Object.fromEntries(resp.responseHeaders
                        .trim().split("\n")
                        .map(((s) => s.split(/:\s*/, 2)))),
                }));
            },
            onabort () { rej(new Error("aborted")); },
            onerror (resp) { rej(new Error(resp.error)); },
        });
    });
}

/**
 * Does network query and re-attempts up to five times
 * @param {FetchFunc} fetch - The fetch function to use for querying
 * @param {string} url - Full URL of the request
 * @param {RequestInit} [params={}] - Get-params of the request
 * @returns {Promise<Response>} Raw server response
 */
async function query (fetch: FetchFunc, url: string, params: RequestInit = {}): Promise<Response> {
    for (const nth of ["Second", "Third", "Fourth", "Fifth"]) {
        try {
            const resp = await fetch(url, params);
            // the 5xx response may be done by Cloudflare which sends HTML and
            // attempt to parse it as JSON will throw error
            if (resp.status >= 500) {
                console.warn(url, `\nServer responded with ${resp.status} code. ${nth} attempt`);
                await sleep(5000);
                continue;
            } else {
                return resp;
            }
        } catch (ex) {
            console.warn(ex, url, `\nFetch error. ${nth} attempt`);
            await sleep(5000);
        }
    }
    // do not mute exception at the last attempt
    return fetch(url, params);
}

/** Does network query and re-attempts up to five times
* @param {FetchFunc} fetch - The fetch function to use for querying
* @param {string} url - Full URL of the request
* @param {RequestInit} [params={}] - Get-params of the request
* @returns {Promise<Response>} Raw server response
*/
async function queryJson (fetch: FetchFunc, url: string, params: RequestInit = {}): Promise<any> {
    const resp = await query(fetch, url, params);
    if (resp.headers.get("content-type")?.includes("/json")) {
        return resp.json();
    }
    console.warn(await resp.text());
    throw new Error("Not a json response");
}

// GET responses
const cache = new TemporalMap(300_000);

/**
 * Make a GET query
 * @param {string} url - Full URL of the request
 * @param {Params} params - Query params to be added to the URL
 * @param {boolean} useGMXHR - use GM.XHR or fetch
 * @returns Promise<any> - JSON response
 */
async function get (url: string, params: Params = {}, useGMXHR = false): Promise<any> {
    const link = new URL(url);
    for (const [key, value] of Object.entries(params)) {
        link.searchParams.append(key, value.toString());
    }
    url = link.toString();
    if (cache.has(url)) return cache.get(url);
    const func = useGMXHR ? gmFetch : fetch;
    const resp = queryJson(func, url, { method: "GET" });
    cache.set(url, resp);
    return resp;
}

/**
 * Send a POST query
 * @param {string} url - Full URL of the request
 * @param {Params} params - Query params to be send
 * @param {boolean} useGMXHR - use GM.XHR or fetch
 * @returns Promise<any> - JSON response
 */
async function post (url: string, params: Params = {}, useGMXHR = false): Promise<any> {
    const func = useGMXHR ? gmFetch : fetch;
    const body: RequestInit = { method: "POST" };
    if (params) {
        const fdata = new FormData();
        for (const [key, value] of Object.entries(params)) {
            fdata.append(key, value.toString());
        }
        body.body = fdata;
    }
    return queryJson(func, url, body);
}

export { get, post, sleep };
