import "./translate.css";

import AnimePicturesApi, { type APTag } from "./lib/AnimePictures";
import DanbooruApi from "./lib/Danbooru";
import { getFromAP, getFromEN, getFromRU } from "./lib/tags";

const TAG_PREFIXES = [
    "ch:",
    "char:",
    "character:",
    "co:",
    "copy:",
    "copyright:",
    "gen:",
    "general:",
    "art:",
    "artist:",
    "meta:",
];
const PREFIX_REGEX = new RegExp(`^[-~(]*(${TAG_PREFIXES.join("|")})?`);
// trim all whitespace (tabs, spaces) except for line returns

/**
 * Toggles the given tag in the given string of tags in russian format
 * @param tagsText - string with tags
 * @param tagName - the tag to toggle
 * @returns the new string of tags
 */
export function toggleRuTag (tagsText: string, tagName: string) {
    const tags = tagsText.split(",");
    let removed = false;
    for (let i = 0; i < tags.length; i++) {
        if (tags[i].trim() === tagName) {
            if (tags[i].includes("\n")) {
                if (i < tags.length - 1) {
                    tags[i + 1] = `\n${tags[i + 1].trim()}`;
                } else {
                    tags[i - 1] += "\n";
                }
            }
            tags.splice(i, 1);
            removed = true;
            break;
        }
    }
    if (!removed) {
        if (tags.at(-1)?.trim() === "") tags.pop();
        tags.push(` ${tagName}`, "");
    }
    return tags.join(",");
}

/**
 * Translates english tag to russian
 * @param elem - the element with the tag
 */
export async function enTag2ruTag (elem: Element) {
    const tagName = elem.textContent;
    if (!tagName) return;
    const tag = await getFromEN(tagName);
    if (tag?.ruName) {
        elem.textContent = tag.ruName;
    } else {
        elem.classList.add("non-translated");
    }
}

/**
 * Translates russian tags to english
 * @param text - comma separated tags
 * @returns text with english tags
 */
export async function ruTags2enTags (text: string): Promise<string> {
    if (text.includes("\n")) {
        const lines = await Promise.all(text.split("\n").map(ruTags2enTags));
        return lines.join("\n");
    }
    const parts = await Promise.all(text.trim().split(/,\s*/).map(async (part) => {
        if (part === "") return part;
        const prefix = part.match(PREFIX_REGEX)?.[0] ?? "";
        const tagName = part.slice(prefix.length);
        // eslint-disable-next-line no-await-in-loop
        const tag = await getFromRU(tagName);
        if (tag) {
            return `${prefix}${(tag.id).replaceAll(" ", "_")}`;
        }
        return part.replaceAll(" ", "_");
    }));
    return parts.join(" ");
}

/**
 * Translates russian tags to english
 * @param text - comma separated tags
 * @returns text with english tags
 */
export async function enTags2ruTags (text: string): Promise<string> {
    if (text.includes("\n")) {
        const lines = await Promise.all(text.split("\n").map(enTags2ruTags));
        return lines.join("\n");
    }
    const parts = await Promise.all(text.trim().split(/\s+/).map(async (part) => {
        if (part === "") return part;
        const prefix = part.match(PREFIX_REGEX)?.[0] ?? "";
        const tagName = part.slice(prefix.length);
        // eslint-disable-next-line no-await-in-loop
        const tag = await getFromEN(tagName);
        if (tag?.ruName) {
            return `${prefix}${tag.ruName}`;
        }
        return part.replaceAll("_", " ");
    }));
    if (parts.at(-1) !== "") parts.push("");
    return parts.join(", ");
}

// ====================================
//  the autocompletion-related stuff
// ====================================

type AutocompleteItem = {
    value: string,
    html: JQuery<HTMLElement>,
}

type AutocompleteInstance = {
    _super: () => void,
    element: JQuery<HTMLInputElement>,
}

const TRIM_REGEX = /^[\t ]+|[\t ]+$/gm;
// danbooru tag consists of only ASCII characters except percent, asterisk, and comma
const DB_TAG_REGEX = /^[\u0020-\u0024\u0026-\u0029+\u002D-\u007F]+$/;
// to convert AP tag catory to DB's one
const AP_2_DB_CATEGORY = [0, 4, 0, 3, 1, 3, 3, 0, 5];

/**
 * Inserts a complete string into a field
 * @param input - the field
 * @param completion - the text to insert
 */
function insertCompletion (input: HTMLInputElement, completion: string) {
    let beforeCaret = input.value.slice(0, input.selectionStart!).replace(TRIM_REGEX, "");
    const afterTextCaret = input.value.slice(input.selectionStart!).replace(TRIM_REGEX, "");

    // update the last tag but keep the prefix
    const tags = beforeCaret.split(/,[\t ]*/);
    const lastTag = tags.pop()!;
    const prefix = lastTag.match(PREFIX_REGEX)?.[0] ?? "";
    tags.push(`${prefix}${completion}, `);
    beforeCaret = tags.join(", ");

    input.value = beforeCaret + afterTextCaret;
    input.selectionStart = beforeCaret.length;
    input.selectionEnd = beforeCaret.length;
    input.dispatchEvent(new KeyboardEvent("input"));
}

/**
 * Extracts the tag under the caret
 * @param $input - the target field
 * @returns the current tag or empty string
 */
function currentTerm ($input: JQuery<HTMLInputElement>) {
    const query = $input.get(0)!.value;
    const caret = $input.get(0)!.selectionStart!;
    return query.slice(0, caret).match(/[^,]*$/)![0].trim().replace(PREFIX_REGEX, "").toLowerCase();
}

/**
 * Round number using suffix `k` or `M`
 * @param n - the number to round
 * @returns text with the number
 */
function round (n: number) {
    return n > 1e6
        ? `${Math.round(n / 1e7) / 10}M`
        : (n > 1000 ? `${Math.round(n / 1e4) / 10}k` : String(n));
}

/**
 * Renders the tag as search item for danbooru's autocomplete
 * @param tag - the found tag
 * @param match - the query string
 * @returns html string
 */
function makeAutocompleteItem (tag: APTag, match: string, stroke = false) {
    let text = (tag.tag_ru ?? tag.tag).replace(match, `<b>${match}</b>`);
    if (tag.alias) {
        text = `<span class="autocomplete-antecedent">${text}</span>
            <span class="autocomplete-arrow">→</span>
            ${tag.alias.tag_ru ?? tag.alias.tag}`;
    }
    return `<li class="ui-menu-item"
        data-autocomplete-type="tag-word"
        data-autocomplete-value="${(tag.alias ?? tag).tag}"
    >
        <div class="ui-menu-item-wrapper" tabindex="-1">
            <a class="tag-type-${AP_2_DB_CATEGORY[tag.type]} ${stroke ? "not-matching" : ""}"
                @click.prevent=""
                href="/posts?tags=${tag.tag}"
            >
                ${text}
            </a>
        <span class="post-count">${round((tag.alias ?? tag).num)}</span>
    </div>
</li>`;
}

/**
 * Generates autocomplete list for the given query
 * @param query - the query to autocomplete
 * @returns list of autocompletions
 */
async function autocompleteSource (query: string): Promise<AutocompleteItem[]> {
    if (query === "") {
        return [];
    }

    if (DB_TAG_REGEX.test(query)) {
        const html = await DanbooruApi.autocompleteTag(query);
        return $(html).find("li").toArray().map((item) => {
            const $item = $(item);
            return { value: $item.data("autocomplete-value"), html: $item };
        });
    }
    const tags = await AnimePicturesApi.findTags(query);
    const uTags = await Promise.all(
        tags.map((tag) => getFromAP(tag.alias ?? tag)),
    );
    return tags.map((tag, i) => ({
        value: tag.alias?.tag_ru ?? tag.tag_ru ?? tag.tag,
        html: $(makeAutocompleteItem(tag, query, uTags[i].type === 1)),
    }));
}

// we cannot create autocompletion with own on_tab,
// so we trick the original one
const origOnTab = Danbooru.Autocomplete.on_tab;
Danbooru.Autocomplete.on_tab = function onTab (this: HTMLInputElement, event: Event) {
    origOnTab.call(this, event);
    setTimeout(() => this.dispatchEvent(new KeyboardEvent("input")), 0);
};

/**
 * Replace field with a fake one that has autocomplete for both EN and RU tags
 * @param origField - the field to replace
 */
export async function autocomplete (origField: HTMLInputElement | HTMLTextAreaElement) {
    const $origField = $(origField);
    const field = $(document.createElement($origField.prop("tagName")));
    field.prop("autocomplete", "off");
    field.addClass($origField.attr("class")!);
    field.autocomplete({
        select (this: HTMLInputElement, _event, ui) {
            insertCompletion(this, ui.item.value);
            return false;
        },
        async source (
            this: AutocompleteInstance,
            _req: string,
            resp: (data: AutocompleteItem[]) => void,
        ) {
            const term = currentTerm(this.element);
            const results = await autocompleteSource(term);
            resp(results);
        },
    });

    $origField.css("display", "none");
    $origField.before(field);
    $origField.on("focus", () => {
        field.trigger("focus").selectEnd();
    });
    field.on("input", async () => {
        $origField.val(await ruTags2enTags(field.val() as string));
    });

    field.val(await enTags2ruTags($origField.val() as string));
}
