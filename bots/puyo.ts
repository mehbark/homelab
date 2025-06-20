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

client.once(Events.ClientReady, (c: Client<true>) => {
    console.log(`okay cool, ${c.user.tag}`);
});

client.login(token);

const db = await Deno.openKv("/home/mbk/bots/discord/puyo.kv");

const mehbark = "354988989100589058";

const square = {
    empty: 0,
    red: 1,
    green: 2,
    blue: 3,
    yellow: 4,
    purple: 5,
} as const;

type Square = (typeof square)[keyof typeof square];

const square_names = Object.fromEntries(
    Object.entries(square).map(([k, v]) => [v, k]),
) as Record<Square, string>;

function squareToEmoji(sq: Square): string {
    if (sq == square.empty) return ":black_large_square:";
    return `:${square_names[sq]}_square:`;
}

function numberToEmoji(n: number, pad = 0): string {
    const digits = `${Math.abs(n)}`.split("");
    const padding = new Array(Math.max(0, pad - digits.length)).fill(
        ":white_large_square:",
    );
    const digits_emoji = digits.map((d) =>
        [
            ":zero:",
            ":one:",
            ":two:",
            ":three:",
            ":four:",
            ":five:",
            ":six:",
            ":seven:",
            ":eight:",
            ":nine:",
        ][Number.parseInt(d)]
    );
    return [...padding, ...digits_emoji].join("");
}

const board = {
    width: 6,
    height: 12,

    inBounds(x: number, y: number): boolean {
        return 0 <= x && x < this.width && 0 <= y && y < this.height;
    },

    mapSquareIndices<T>(proc: (x: number, y: number) => T): T[] {
        const out = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                out.push(proc(x, y));
            }
        }
        return out;
    },

    mapRows<T>(
        proc: (sq: { x: number; y: number; square: Square }) => Promise<T>,
    ): Promise<T[][]> {
        const out = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(
                    db.get(["board", x, y]).then(({ value }) => {
                        assert(
                            typeof value == "number" && value in square_names,
                        );
                        return proc({ x, y, square: value as Square });
                    }),
                );
            }
            out.push(Promise.all(row));
        }
        return Promise.all(out);
    },

    async init({ force = false } = {}) {
        if (!force && (await db.get(["board", 0, 0])).value != null) return;
        await Promise.all(this.mapSquareIndices((x, y) => {
            return db.set(["board", x, y], square.empty);
        }));
    },

    async status(): Promise<string> {
        const rows =
            (await this.mapRows(({ square }) =>
                Promise.resolve(squareToEmoji(square))
            )).map((row) => row.join("")).map((r, i) =>
                `${numberToEmoji(i, 2)}${r}`
            );
        return [
            ":white_large_square::white_large_square:" +
            new Array(board.width).fill(undefined).map((_, i) =>
                numberToEmoji(i)
            ).join(""),
            ...rows,
        ].join("\n");
    },

    async set(
        { x, y, sq }: { x: number; y: number; sq: Square },
    ): Promise<boolean> {
        if (!this.inBounds(x, y)) return false;
        await db.set(["board", x, y], sq);
        return true;
    },
};

await board.init();

const commands: Record<string, (args: string[]) => Promise<string>> = {
    async clear() {
        await board.init({ force: true });
        return "db cleared";
    },
    async dump() {
        const out = [];
        for await (const sq of db.list({ prefix: ["board"] })) {
            out.push(sq);
        }
        return "```json\n" + JSON.stringify(out).slice(0, 1900) + "\n```";
    },
    die() {
        Deno.exit(2);
    },
    async set(args) {
        const usage = "```\nUSAGE:\nset x y (" +
            Object.keys(square).toSorted().join("|") + ")\n```";

        if (
            args.length != 3 || Number.isNaN(Number.parseInt(args[0])) ||
            Number.isNaN(Number.parseInt(args[1])) || !(args[2] in square)
        ) {
            return usage;
        }
        if (
            !(await board.set({
                x: Number.parseInt(args[0]),
                y: Number.parseInt(args[1]),
                sq: square[args[2] as keyof typeof square],
            }))
        ) {
            return "oob";
        }

        return board.status();
    },
    view() {
        return board.status();
    },
    help() {
        return Promise.resolve(
            "commands:\n" +
                Object.keys(commands).toSorted().map((k) =>
                    `- ${k}${admin_commands.includes(k) ? " (admin)" : ""}`
                ).join("\n"),
        );
    },
};

const admin_commands: string[] = ["clear", "dump", "die"];

client.on("messageCreate", async (message) => {
    if (message.author == id || !message.mentions.has(id)) return;

    const is_admin = message.author.id == mehbark;
    const args = message.content.toLowerCase().split(/\s+/).filter((arg) =>
        !arg.includes("@")
    );
    console.log(`${message.author.id}: ${JSON.stringify(args)}`);
    if (
        args[0] && args[0] in commands &&
        (is_admin || !admin_commands.includes(args[0]))
    ) {
        message.reply((await commands[args[0]](args.slice(1))).slice(0, 2000));
    } else {
        message.reply(
            (await commands.help([])).slice(0, 1900),
        );
    }
});
