type SerializedCache<T extends { id:any }> = {
    level1: T[],
    level2: T[],
    lastUpdate: number,
}

export default class Cache<T extends { id:any }> {
    #name: string;
    #level1: Map<T["id"], T>;
    #level2: Map<T["id"], T>;
    #lastUpdate: number;

    /**
     * Creates a collection with given data and removes outdated objects
     * @param name - the name for reading and saving in `localStore`
     * @param lifetime - time after which object will be removed if not used, ms
     */
    constructor (name: string, lifetime: number) {
        this.#name = name;
        const data = name in localStorage
            ? JSON.parse(localStorage.getItem(name)!) as SerializedCache<T>
            : { level1: [], level2: [], lastUpdate: 0 };
        this.#level1 = new Map(data.level1.map((item) => [item.id, item]));
        this.#level2 = new Map(data.level2.map((item) => [item.id, item]));
        this.#lastUpdate = data.lastUpdate;

        if (this.#lastUpdate + lifetime  < Date.now()) {
            this.#level2 = this.#level1;
            this.#level1 = new Map();
            this.#lastUpdate = Date.now();
            this.save();
        }
    }

    /**
     * Retrieve an object with a given ID
     * @param id - the object's `id` field
     * @returns the found object or `undefined`
     */
    get (id: T["id"]) {
        let item = this.#level1.get(id);
        if (!item) {
            item = this.#level2.get(id);
            if (item) {
                this.#level1.set(id, item);
                this.#level2.delete(id);
                this.save();
            }
        }
        return item;
    }

    /**
     * Retrieve all objects
     * @returns array of objects
     */
    getAll () {
        return [...this.#level1.values(), ...this.#level2.values()];
    }

    /**
     * Number of items in the cache
     */
    get size () {
        return this.#level1.size + this.#level2.size;
    }

    /**
     * Removes object with the given ID
     * @param id - the object's `id` field
     * @returns whether the object existed and was removed
     */
    remove (id: T["id"]) {
        if (this.#level1.delete(id) || this.#level2.delete(id)) {
            this.save();
            return true;
        }
        return false;
    }

    /**
     * Adds an object
     * @param item - the object to add
     */
    add (item: T) {
        this.remove(item.id);
        this.#level1.set(item.id, item);
        this.save();
    }

    /**
     * Remove all objects
     */
    clear () {
        this.#level1 = new Map();
        this.#level2 = new Map();
        this.#lastUpdate = Date.now();
        this.save();
    }

    #timer: NodeJS.Timeout | null = null;
    /**
     * Schedule saving the cache to `localStore`, cancels previous scheduling
     * @param delay - the delay of saving in ms
     */
    save (delay = 1000) {
        if (this.#timer) {
            clearTimeout(this.#timer);
            this.#timer = null;
        }
        if (delay) {
            this.#timer = setTimeout(() => {
                this.#save();
                this.#timer = null;
            }, delay);
        }
    }

    /**
     * Saves the cache to `localStore`
     */
    #save () {
        const data: SerializedCache<T> = {
            level1: Array.from(this.#level1.values()),
            level2: Array.from(this.#level2.values()),
            lastUpdate: this.#lastUpdate,
        };
        localStorage.setItem(this.#name, JSON.stringify(data));
    }
}
