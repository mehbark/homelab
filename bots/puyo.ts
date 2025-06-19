import { Client, Events, GatewayIntentBits } from "npm:discord.js";
import { assert } from "jsr:@std/assert";

const { default: { token, id } } = await import(Deno.args[0], {
    with: { type: "json" },
});

if (!token || !id) {
    console.error("token or id missing from config file");
    Deno.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once(Events.ClientReady, (c) => {
    console.log(`okay cool, ${c.user.tag}`);
});

client.login(token);

const db = await Deno.openKv();

const mehbark = "354988989100589058";

const board = {
    width: 6,
    height: 12,

    mapSquareIndices<T>(proc: (x: number, y: number) => T): T[] {
        const out = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                out.push(proc(x, y));
            }
        }
        return out;
    },

    async init({ force = false } = {}) {
        if (!force && (await db.get(["board"])).value != null) return;
        await db.set(
            ["board"],
            this.mapSquareIndices((x, y) => ({ x, y, color: null })),
        );
    },

    async preview(): Promise<string> {
        return JSON.stringify((await db.get(["board"])).value);
    },
};

await board.init();

client.on("messageCreate", async (message) => {
    if (message.author == id || !message.mentions.has(id)) return;

    if (message.author.id == mehbark && message.content.includes("clear")) {
        await board.init({ force: true });
        message.reply("db cleared");
    } else {
        message.reply(
            "```json\n" + (await board.preview()).slice(0, 1900) + "\n```",
        );
    }
});
