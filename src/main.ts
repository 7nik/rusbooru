import { autocomplete, enTag2ruTag, toggleRuTag } from "./translate";

console.log("start");

for (const elem of document.querySelectorAll(`
    #tag-list .tag-type-0 .search-tag,
    #tag-box .tag-type-0 .search-tag,
    #tag-list .tag-type-5 .search-tag,
    #tag-box .tag-type-5 .search-tag
`)) {
    enTag2ruTag(elem);
}

if (typeof Danbooru === "undefined" || !Danbooru.Autocomplete) {
    console.error("No Danbooru.Autocomplete yet");
}

($("#post_tag_string, #tags") as JQuery<HTMLInputElement | HTMLTextAreaElement>)
    .each((_i, elem) => { autocomplete(elem); });

const container = document.getElementById("related-tags-container");
if (container) {
    new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node instanceof Element) {
                    for (const elem of node.querySelectorAll(".tag-type-0,.tag-type-5")) {
                        enTag2ruTag(elem);
                    }
                }
            }
        }
    }).observe(container, { childList: true, subtree: true });
    $(container).on("change click", "input, a", function toggle (this: HTMLElement) {
        const tagName = this.textContent?.trim();
        if (!tagName) return;
        const field = document.getElementById("post_tag_string")
            ?.previousElementSibling as HTMLTextAreaElement;
        field.value = toggleRuTag(field.value, tagName);
        setTimeout(() => field.dispatchEvent(new KeyboardEvent("input")));
    });
}
