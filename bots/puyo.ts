// deno-lint-ignore-file require-await
import { Buffer } from "node:buffer";
import { Client, Events, GatewayIntentBits } from "npm:discord.js";

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
type Board = Square[][];

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

    mapRowIndices<T>(proc: (x: number, y: number) => T): T[][] {
        const out = [];
        for (let y = 0; y < this.height; y++) {
            const row = [];
            for (let x = 0; x < this.width; x++) {
                row.push(proc(x, y));
            }
            out.push(row);
        }
        return out;
    },

    async squares(): Promise<Board> {
        return (await db.get(["board"])).value as Board;
    },

    async init({ force = false } = {}) {
        if (!force && (await db.get(["board"])).value != null) return;
        await db.set(["board"], this.mapRowIndices(() => square.empty));
    },

    async status(): Promise<string> {
        const rows = (await this.squares()).map((row, y) =>
            `${numberToEmoji(y, 2)}${
                row.map((sq) => squareToEmoji(sq)).join("")
            }`
        );
        return [
            ":white_large_square::white_large_square:" +
            new Array(board.width).fill(undefined).map((_, i) =>
                numberToEmoji(i)
            ).join(""),
            ...rows,
        ].join("\n");
    },

    async get({ x, y }: { x: number; y: number }): Promise<Square | undefined> {
        if (!this.inBounds(x, y)) return;
        return (await this.squares())[y][x];
    },

    async set(
        { x, y, sq }: { x: number; y: number; sq: Square },
    ): Promise<boolean> {
        if (!this.inBounds(x, y)) return false;
        const board = await db.get(["board"]);
        if (!Array.isArray(board.value)) {
            console.error("what is this garbage", board);
            return false;
        }
        await db.atomic()
            .check(board)
            .set(
                ["board"],
                board.value.with(y, board.value[y].with(x, sq)),
            )
            .commit();
        await db.set(["board", x, y], sq);
        return true;
    },
    // todo: bigger board by making an image
    // async pngBuffer() {
    //     const bitmap = await createImageBitmap(null as any);
    //     const squares = await this.squares();
    //     for (const row of squares) {
    //         for (const square of row) {
    //         }
    //     }
    // },
};

await board.init();

const oob_dialogue = new TextDecoder().decode(
    await Deno.readFile("/home/mbk/bots/discord/dr-dump.txt"),
).split("\n");

type Fun = (stack: Val[], depth: number) => Promise<void>;
type Val = number | { run: Fun; src: string[] };

function stringOfVal(x: Val): string {
    if (typeof x == "number") return `\`${x.toString()}\``;
    return "`( " + x.src.join(" ") + " )`";
}

function closingParenIndex(args: string[], start: number): number {
    let depth = 0;
    for (let search = start; search < args.length; search++) {
        if (args[search] == "(") {
            depth += 1;
        } else if (args[search] == ")") {
            depth -= 1;
        }
        if (depth < 0) throw "unmatched )";
        if (depth == 0) {
            return search;
        }
    }
    return -1;
}

async function getDef(
    { namespace, def, depth }: {
        namespace: string;
        def: string;
        depth: number;
    },
): Promise<Val> {
    if (depth > 1000) throw "recursion limit reached in `getDef`";

    const { value } = await db.get<string[]>([
        "run",
        "def",
        namespace,
        def,
    ]);
    if (value == null) throw `${def} not found in ${namespace}`;
    // ha
    const stack: Val[] = [];
    await run({ args: value, stack, username: namespace, depth: depth + 1 });
    return stack.pop() ?? 0;
}

const Local = Symbol("local");
const Above = Symbol("above");

type Env = Record<string, Val> | { [Local]: Record<string, Val>; [Above]: Env };

function lookup(env: Env, key: string): Val | undefined {
    if (Local in env) {
        if (key in env[Local]) {
            return env[Local][key];
        } else {
            return lookup(env[Above], key);
        }
    } else {
        return env[key];
    }
}

function has(env: Env, key: string): boolean {
    return typeof lookup(env, key) != "undefined";
}

function set(env: Env, key: string, val: Val) {
    if (Above in env) {
        if (has(env[Above], key)) {
            set(env[Above], key, val);
        } else {
            env[Local][key] = val;
        }
    } else {
        env[key] = val;
    }
}

function setTop(env: Env, key: string, val: Val) {
    if (Above in env) {
        setTop(env[Above], key, val);
    } else {
        env[key] = val;
    }
}

function markdownOfEnv(env: Env): string {
    if (Above in env) {
        let out = markdownOfEnv(env[Local]);
        if (
            Object.keys(env[Above]).length != 0 ||
            Object.keys(env[Local]).length != 0
        ) {
            out += "\n~~          ~~\n";
        }
        out += markdownOfEnv(env[Above]);
        return out;
    } else {
        return Object.entries(env).toSorted().map(([k, v]) =>
            `- ${stringOfVal(v)} →${k}`
        ).join("\n");
    }
}

async function run(
    {
        args,
        stack = [],
        env = { [Local]: {}, [Above]: {} },
        depth,
        username,
    }: {
        args: string[];
        username: string;
        stack?: Val[];
        env?: Env;
        depth: number;
    },
): Promise<void> {
    function explode(msg = "i esploded") {
        throw msg + "\n" + "stack:\n" +
            stack.toReversed().map((s) => `1. ${stringOfVal(s)}`).join(
                "\n",
            ) +
            `\nenv:\n${markdownOfEnv(env)}`;
    }

    if (depth > 1000) explode("recursion limit reached");
    const push = (x: Val) => stack.push(x);
    const popn = (): number => {
        const popped = stack.pop();
        if (!popped || typeof popped != "number") return 0;
        return popped;
    };
    const popf = (): Fun => {
        const popped = stack.pop();
        if (typeof popped == "undefined") return async () => {};
        if (typeof popped == "number") {
            return async () => {
                push(popped);
            };
        }
        return popped.run;
    };
    const popb = (): boolean => popn() != 0;
    const pop = (): Val => stack.pop() ?? 0;

    const ops: Record<string, () => Promise<void>> = {
        async "+"() {
            push(popn() + popn());
        },
        async "-"() {
            const subtrahend = popn();
            const minuend = popn();
            // now (1 -) subtracts one from the top of the stack
            push(minuend - subtrahend);
        },
        async "*"() {
            push(popn() * popn());
        },
        async "/"() {
            const divisor = popn();
            const dividend = popn();
            // now (2 /) divides the top of the stack by 2
            push(dividend / divisor);
        },
        async "="() {
            push(popn() == popn() ? 1 : 0);
        },
        async "!"() {
            await popf()(stack, depth + 1);
        },
        async "get"() {
            const y = popn();
            const x = popn();
            push(await board.get({ x, y }) ?? 0);
        },
        async "set"() {
            const color = popn() % 6;
            const y = popn();
            const x = popn();
            await board.set({
                x,
                y,
                sq: Math.floor(Math.abs(color)) as Square,
            });
        },
        async "dup"() {
            const top = pop();
            push(top);
            push(top);
        },
        async "swap"() {
            const fst = pop();
            const snd = pop();
            push(fst);
            push(snd);
        },
        async "ite"() {
            const els = popf();
            const then = popf();
            const bool = popb();
            if (bool) {
                await then(stack, depth + 1);
            } else {
                await els(stack, depth + 1);
            }
        },
        async "self"() {
            push({
                run: async (stack) => {
                    await run({
                        args,
                        stack,
                        env,
                        depth: depth + 1,
                        username,
                    });
                },
                src: args,
            });
        },
        async "explode"() {
            explode();
        },
        async "floor"() {
            push(Math.floor(popn()));
        },
        async "sin"() {
            push(Math.sin(popn()));
        },
        async "cos"() {
            push(Math.cos(popn()));
        },
        async "tan"() {
            push(Math.tan(popn()));
        },
    };

    let i = 0;
    for (let step = 0; step < 1000 && i < args.length; step++) {
        const arg = args[i];
        const num = Number.parseInt(arg);
        const val = lookup(env, arg);
        if (typeof val != "undefined") {
            push(val);
        } else if (Number.isFinite(num)) {
            push(num);
        } else if (arg.match(/^(->|→)/)) {
            const name = arg.replace(/->|→/, "");
            set(env, name, pop());
        } else if (arg in ops) {
            await ops[arg]();
        } else if (arg == "(") {
            const close = closingParenIndex(args, i);
            if (close == -1) {
                throw "unmatched (";
            }
            const subr = args.slice(i + 1, close);
            push({
                run: async (stack, depth) => {
                    await run({
                        args: subr,
                        stack,
                        env: { [Local]: {}, [Above]: env },
                        depth,
                        username,
                    });
                },
                src: subr,
            });
            i = close;
        } else if (arg == ")") {
            throw "unmatched )";
        } else if (arg.includes("/")) {
            const [namespace, def] = arg.split("/", 2);
            const val = await getDef({
                namespace,
                def,
                depth: depth + 1,
            });
            // cache def
            setTop(env, arg, val);
            push(val);
        } else {
            const val = await getDef({
                namespace: username,
                def: arg,
                depth: depth + 1,
            });
            setTop(env, arg, val);
            push(val);
        }
        i++;
    }
    return;
}

const commands: Record<
    string,
    (
        args: string[],
        more: { username: string; originalSrc: string },
    ) => Promise<string | Buffer>
> = {
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
        console.log("dying on purpose rn");
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
    oob() {
        return Promise.resolve(
            "```\n" +
                oob_dialogue[Math.floor(Math.random() * oob_dialogue.length)] +
                "\n```",
        );
    },
    async run(args, { username }) {
        const err = await run({ args, username, depth: 0 }).catch((e) => e);
        if (err) return err.toString();
        return board.status();
    },
    async define([name, ...args], { username: namespace }) {
        if (!namespace || !name || args.length == 0) {
            return "i need `name program...`";
        }
        await db.set(["run", "def", namespace, name], args);
        return `defined \`${name}\` in \`${namespace}\` (\`${namespace}/${name}\`)`;
    },
    async definitions([name], { username }) {
        if (!name) name = username;
        const defs: [string, string[]][] = [];
        for await (
            const { key, value } of db.list<string[]>({
                prefix: ["run", "def", name],
            })
        ) {
            defs.push([key.slice(2).join("/"), value]);
        }
        return name + "'s defs\n" +
            defs.toSorted().map(([k, v]) =>
                `- ${
                    stringOfVal({
                        run: () => Promise.resolve(),
                        src: v,
                    })
                } →${k}`
            ).join("\n");
    },
    async run2(_, { originalSrc }) {
        const src = originalSrc.replace("run2", "").replaceAll(
            /<@\d+>|```/g,
            "",
        );
        const cmd = new Deno.Command("/run/current-system/sw/bin/puyo-lang", {
            stdin: "piped",
            stdout: "piped",
            stderr: "piped",
            env: {
                CLICOLOR_FORCE: "1",
            },
        });
        const child = cmd.spawn();
        const writer = child.stdin.getWriter();
        await writer.write(new TextEncoder().encode(src));
        await writer.close();
        const { stdout, stderr } = await child.output();
        const bbb = "```";
        return `stdout:
${bbb}ansi
${new TextDecoder().decode(stdout) || "<empty>"}
${bbb}
stderr:
${bbb}ansi
${new TextDecoder().decode(stderr) || "<empty>"}
${bbb}
`;
    },
};

const admin_commands: string[] = ["clear", "dump", "die"];

client.on("messageCreate", async (message) => {
    if (message.author == id || !message.mentions.has(id)) return;

    const is_admin = message.author.id == mehbark;
    const cmds = message.content.toLowerCase()
        .replaceAll(
            /[()!]/g,
            (p) => ` ${p} `,
        )
        .replaceAll("`", "")
        .split(/;+/)
        .filter((x) => x.match(/[^ ]/))
        .map((cmd) =>
            cmd.split(/\s+/).filter((arg) => arg != "" && !arg.includes("@"))
        );
    console.log(`${message.author.id}: running ${cmds.length} commands`);
    const outputs = [];
    for (const args of cmds) {
        console.log(`| ${message.author.id}: ${JSON.stringify(args)}`);
        if (
            args[0] && args[0] in commands &&
            (is_admin || !admin_commands.includes(args[0]))
        ) {
            const res = await commands[args[0]](
                args.slice(1),
                {
                    username: message.author.username,
                    originalSrc: message.content,
                },
            );
            outputs.push(res);
        } else {
            const res = await commands.run(
                args,
                {
                    username: message.author.username,
                    originalSrc: message.content,
                },
            );
            outputs.push(res);
        }
    }
    const output = outputs.at(-1) ?? "";
    if (typeof output == "string") {
        await message.reply(output.slice(0, 2000));
    } else {
        await message.reply({ files: [{ attachment: output }] });
    }
    console.log(
        `${message.author.id}: finished running ${cmds.length} commands`,
    );
});
