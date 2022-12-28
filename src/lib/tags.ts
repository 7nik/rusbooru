/* eslint-disable no-await-in-loop */
import type { APTag } from "./AnimePictures";
import AnimePicturesApi from "./AnimePictures";
import Cache from "./Cache";
import DanbooruApi, { type DBTag } from "./Danbooru";

type Tag = {
    // apId: number,
    /**
     * 1 - AP only, 2 - DB only, 3 - both equal, 4 - both different
     */
    type: number,
    /**
     * enName
     */
    id: string,
    /**
     * presented only with type = 4
     */
    apName?: string,
    ruName?: string,
}

const enCache = new Cache<Tag>("rusbooru_tag-cache", /* 1 month */30 * 86_400_000);
const apCache = new Map<string, Tag>();
const ruCache = new Map<string, Tag>();
for (const tag of enCache.getAll()) {
    if (tag.type === 4) {
        apCache.set(tag.apName!, tag);
    } else if (tag.type !== 2) {
        apCache.set(tag.id, tag);
    }
    if (tag.ruName) ruCache.set(tag.ruName, tag);
}

function saveTag (tag: Tag) {
    enCache.add(tag);
    if (tag.type === 4) {
        apCache.set(tag.apName!, tag);
    } else if (tag.type !== 2) {
        apCache.set(tag.id, tag);
    }
    if (tag.ruName) ruCache.set(tag.ruName, tag);
    console.log("cache size", enCache.size, tag.id);
}

export async function getFromAP (aTag: APTag) {
    if (aTag.alias) aTag = aTag.alias;
    let uTag = apCache.get(aTag.tag);
    if (uTag) return uTag;
    uTag = {
        type: 1,
        id: aTag.tag,
    };
    if (aTag.tag_ru) uTag.ruName = aTag.tag_ru;
    let dTag = await DanbooruApi.getTag(uTag.id);
    if (!dTag) {
        for (const alias of await AnimePicturesApi.getAliases(aTag.id)) {
            dTag = await DanbooruApi.getTag(alias.tag);
            if (dTag) break;
        }
    }
    if (dTag) {
        if (dTag.antecedent_alias) {
            dTag = (await DanbooruApi.getTag(dTag.antecedent_alias.consequent_name))!;
        }
        const name = dTag.name.replaceAll("_", " ");
        if (name === uTag.id) {
            uTag.type = 3;
        } else {
            uTag.type = 4;
            uTag.apName = uTag.id;
            uTag.id = name;
        }
    }

    saveTag(uTag);
    return uTag;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function getFromDB (dTag: DBTag) {
    const name = dTag.name.replaceAll("_", " ");
    if (dTag.antecedent_alias) {
        dTag = (await DanbooruApi.getTag(dTag.antecedent_alias.consequent_name))!;
    }
    let uTag = enCache.get(name);
    if (uTag) return uTag;

    uTag = {
        type: 2,
        id: name,
    };
    let aTag = await AnimePicturesApi.getTagByName(name);
    if (!aTag) {
        for (const alias of dTag.consequent_aliases) {
            aTag = await AnimePicturesApi.getTagByName(alias.antecedent_name);
            if (aTag) break;
        }
    }
    if (aTag) {
        if (aTag.alias) aTag = aTag.alias;
        if (aTag.tag_ru) uTag.ruName = aTag.tag_ru;
        if (aTag.tag === uTag.id) {
            uTag.type = 3;
        } else {
            uTag.type = 4;
            uTag.apName = aTag.tag;
        }
    }

    saveTag(uTag);
    return uTag;
}

const getting = new Map<string, Promise<Tag|null>>();

export async function getFromEN (name: string) {
    name = name.replaceAll("_", " ").toLowerCase();
    if (getting.has(name)) return getting.get(name) ?? null;
    // eslint-disable-next-line no-async-promise-executor
    const promise = new Promise<Tag|null>(async (res) => {
        const uTag = enCache.get(name);
        if (uTag) {
            res(uTag);
            return;
        }
        const aTag = await AnimePicturesApi.getTagByName(name);
        if (aTag) {
            res(getFromAP(aTag));
            return;
        }
        const dTag = await DanbooruApi.getTag(name);
        if (dTag) {
            res(getFromDB(dTag));
            return;
        }
        res(null);
    });
    getting.set(name, promise);
    promise.then(() => { getting.delete(name); });
    return promise;
}

export async function getFromRU (name: string) {
    if (getting.has(name)) return getting.get(name) ?? null;
    // eslint-disable-next-line no-async-promise-executor
    const promise = new Promise<Tag|null>(async (res) => {
        const uTag = ruCache.get(name);
        if (uTag) {
            res(uTag);
            return;
        }
        const aTag = await AnimePicturesApi.getTagByName(name);
        if (aTag) {
            res(getFromAP(aTag));
            return;
        }
        res(null);
    });
    getting.set(name, promise);
    promise.then(() => { getting.delete(name); });
    return promise;
}
