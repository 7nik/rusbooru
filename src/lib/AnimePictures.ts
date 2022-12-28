import { get } from "./ajax";

const MAX_ACTIVE = 7;
let active = 0;
const queue: (() => void)[] = [];

async function execGet (args: Parameters<typeof get>) {
    active += 1;
    const promise = get(...args);
    promise.finally(() => {
        active -= 1;
        if (queue.length > 0) {
            // start next task
            queue.shift()!();
        }
    });
    return promise;
}

const pooledGet = new Proxy(get, {
    apply: async function apply (_target, _thisArg, args: Parameters<typeof get>) {
        if (active < MAX_ACTIVE) {
            return execGet(args);
        }
        return new Promise((res, rej) => {
            queue.push(() => execGet(args).then(res, rej));
        });
    },
});

type Tag = {
    id: number,
    tag: string, // tag name
    tag_ru: string | null,
    tag_jp: string | null,
    num: number, // total number of posts with this tag
    num_pub: number, // number public posts
    /**
     *  0 - unknown,
     *  1 - character,
     *  2 - reference,
     *  3 - copyright (product),
     *  4 - author,
     *  5 - game copyright,
     *  6 - other copyright,
     *  7 - object,
     */
    type: 0|1|2|3|4|5|6|7,
    description_en: string,
    description_ru: string,
    description_jp: string,
    alias: number | null, // whether it's alias and to whom
    parent: number | null, // whether it's a child and whose
    views: number, // now this counter is disabled
}

type TagA = Omit<Tag, "alias"> & { alias: TagA | null };

type TagSearchResult = {
    success: boolean,
    offset: number,
    limit: number,
    tags: Tag[],
}

type GetTagResult = {
    success: boolean,
    tag: Tag,
}

type GetTagsResult = {
    success: boolean,
    tags: Tag[],
}

const AnimePictures = {
    /**
     * Does a search by part of tag name
     * @param tagName - partial or full tag name
     * @returns matched tags
     */
    async findTags (tagName: string): Promise<TagA[]> {
        const res: TagSearchResult = await pooledGet(
            `https://anime-pictures.net/api/v3/tags`,
            {
                "tag:smart_like": tagName.toLowerCase(),
                order: "num",
                limit: 20,
            },
            true,
        );
        return Promise.all(res.tags.map(resolveAlias));
    },
    /**
     * Get tag info by its Id
     * @param tagId - ID of the tag
     * @return tag info
     */
    async getTagById (tagId: number): Promise<TagA|null> {
        const res: GetTagResult = await pooledGet(
            `https://anime-pictures.net/api/v3/tags/${tagId}`,
            {},
            true,
        );
        return res.tag ? resolveAlias(res.tag) : null;
    },
    /**
     * Find a tag by the given english name
     * @param tagName - name of tag to search
     * @returns tag info
     */
    async getTagByName (tagName: string): Promise<TagA|null> {
        const res: TagSearchResult = await pooledGet(
            `https://anime-pictures.net/api/v3/tags`,
            { tag: tagName.toLowerCase() },
            true,
        );
        if (res.tags.length > 1) {
            console.warn("Found multiple tags of", tagName, res.tags);
        }
        return res.tags[0] ? resolveAlias(res.tags[0]) : null;
    },
    /**
     * Retrieves the tag's aliases
     * @param tagId - the main tag ID
     * @returns list of tag's aliases
     */
    async getAliases (tagId: number) {
        const res: GetTagsResult = await pooledGet(
            `https://anime-pictures.net/api/v3/tags/${tagId}/aliases`,
            {},
            true,
        );
        return res.tags;
    },
};

/**
 * Replaces tag ID in the `alias` prop with the tag alias object
 * @param tag - the tag object
 * @returns the new object
 */
async function resolveAlias (tag: Tag): Promise<TagA> {
    return tag.alias
        ? {
            ...tag,
            alias: await AnimePictures.getTagById(tag.alias),
        }
        : tag as TagA;
}

export default AnimePictures;
export type { TagA as APTag };
