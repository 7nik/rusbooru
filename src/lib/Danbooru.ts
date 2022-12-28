import { get } from "./ajax";

type Alias = {
    id: number,
    antecedent_name: string,
    reason: string,
    creator_id: number,
    consequent_name: string,
    status: string,
    forum_topic_id: number | number,
    created_at: string,
    updated_at: string,
    approver_id: number | null,
    forum_post_id: number | null,
}

type FullTag = {
    id: number,
    name: string,
    post_count: number,
    category: number,
    created_at: string,
    updated_at: string,
    is_deprecated: boolean,
    words: string[],
}

type Tag = Pick<FullTag, "id"|"name"|"category"> & {
    antecedent_alias?: Alias,
    consequent_aliases: Alias[],
}

const DOMAIN = window.location.origin;

const Danbooru = {
    /**
     * Does autocomplete request
     * @param tagName - the tag to complete
     * @param type - type of completion
     * @returns html text
     */
    async autocompleteTag (tagName: string, type = "tag_query") {
        // use fetch because result is html
        const resp = await fetch(`${DOMAIN}/autocomplete?${new URLSearchParams({
            "search[query]": tagName,
            "search[type]": type,
            version: "1",
            limit: "20",
        })}`);
        if (!resp.ok) return "<ul></ul>";
        return resp.text();
    },
    /**
     * Retrieves tag by it's name, including its aliases
     * @param tagName - the tag name
     * @returns the tag or `null`
     */
    async getTag (tagName: string): Promise<Tag|null> {
        tagName = tagName.replaceAll(" ", "_");
        const res: Tag[] = await get(`${DOMAIN}/tags.json`, {
            "search[name]": tagName,
            only: "id,name,category,antecedent_alias,consequent_aliases",
        });
        return res[0] ?? null;
    },
};

export default Danbooru;
export type { Tag as DBTag };
