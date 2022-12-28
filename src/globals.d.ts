declare global {
    var Danbooru: {
        Autocomplete: {
            MAX_RESULTS: number,
            VERSION: number
            autocomplete_source (query: string, type: string): Promise<AutocompleteItem[]>,
            current_term ($input: JQuery<HTMLInputElement>): string,
            initialize_all (): void,
            initialize_fields ($fields: JQuery, type: string): void,
            initialize_mention_autocomplete ($fields: JQuery): void,
            initialize_tag_autocomplete (): void,
            insert_completion (input: HTMLInputElement, completion: string): void
            on_tab (event: Event): void,
            render_item (list: HTMLElement, item: AutocompleteItem): HTMLElement,
            tag_prefixes (): string[],
        }
    };
}

export {};
