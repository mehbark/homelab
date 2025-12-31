// deno-lint-ignore-file require-await
import { Buffer } from "node:buffer";
import {
    Client,
    Events,
    GatewayIntentBits,
    RoleResolvable,
} from "npm:discord.js@^14.0.0";
import * as prng from "jsr:@esm-alea/prng@0.3.0";
import { Image } from "jsr:@matmen/imagescript@1.3.1";

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

const square_colors: Record<Square, string> = {
    [square.empty]: "#31373D",
    [square.red]: "#DD2E44",
    [square.green]: "#78B159",
    [square.blue]: "#55ACEE",
    [square.yellow]: "#FDCB58",
    [square.purple]: "#AA8ED6",
};

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

    async htmlStatus(): Promise<string> {
        const rows = (await this.squares()).map((row) =>
            `<tr>${
                row.map((s) =>
                    `<td style="background-color:${square_colors[s]}"></td>`
                ).join("")
            }</tr>`
        );
        // the whole table gets replaced, but polling means that spurious failures can be handled more gracefully
        return `<table id="preview" hx-get="/" hx-swap="outerHTML" hx-trigger="every 1s"><tbody>${
            rows.join("")
        }</tbody></table>`;
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
): Promise<Val[]> {
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
        async "<"() {
            const fst = popn();
            const snd = popn();
            push(snd < fst ? 1 : 0);
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
        const num = Number.parseFloat(arg);
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
    return stack;
}

function markdownOfUnixTimestamp(time: number): string {
    return `<t:${Math.floor(time)}:f>`;
}

const commands: Record<
    string,
    (
        args: string[],
        more: {
            username: string;
            userId: string;
            originalSrc: string;
            isAdmin: boolean;
        },
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
    async start(args, { userId }) {
        if (args.length == 0) return "GIVE ME A THING";
        const thing = args[0];
        const time = Math.floor(new Date().getTime() / 1000);
        await db.set(["span", userId, "start", time], thing);
        return `\`${thing}\` started ${markdownOfUnixTimestamp(time)}`;
    },
    async stop(args, { userId }) {
        if (args.length == 0) return "GIVE ME A THING";
        const thing = args[0];
        const time = Math.floor(new Date().getTime() / 1000);
        await db.set(["span", userId, "stop", time], thing);
        return `\`${thing}\` stopped ${markdownOfUnixTimestamp(time)}`;
    },
    async spans(args, { userId }) {
        if (args.length > 1) return "give me a thing or give me no thing";
        const thing_of_interest: string | null = args[0];
        const out: [string, number][] = [];
        const events = db.list<string>({ prefix: ["span", userId] });
        for await (const event of events) {
            const [type, time] = event.key.slice(2);
            if (typeof time != "number") continue;

            const thing = event.value;

            if (thing_of_interest && thing != thing_of_interest) continue;
            out.push(
                [
                    `- \`${String(thing)}\` ${String(type)}: ${
                        markdownOfUnixTimestamp(time)
                    }`,
                    time,
                ],
            );
        }
        out.sort((a, b) => b[1] - a[1]);
        return out.map((x) => x[0]).join("\n");
    },
    async rescind(_args, { userId }) {
        const events = await Array.fromAsync(
            db.list<string>({ prefix: ["span", userId] }),
        );

        const most_recent = events.map((e) => e.key).filter((key) =>
            key.length == 4 && typeof key[3] == "number"
        ).toSorted((
            a,
            b,
        ) => (a[3] as number) - (b[3] as number)).at(-1);

        if (most_recent) {
            await db.delete(most_recent);
            return `rescindified the ${most_recent[2] as string} event at ${
                markdownOfUnixTimestamp(most_recent[3] as number)
            }`;
        } else {
            return "yeah idk what you're talking about there's nothing to rescind mkay";
        }
    },
    async time(args, { userId, username, isAdmin }) {
        const subcommands: Record<
            string,
            (val: string | undefined) => Promise<string>
        > = {
            async offset(val) {
                if (val) {
                    const offset = Number.parseInt(val);
                    if (Number.isNaN(offset) || offset < -12 || offset > 14) {
                        return "-12..=14 plz";
                    }
                    await db.set(["time", "offset", userId], offset);
                    if (
                        (await db.get(["time", "username", userId])).value ===
                            null
                    ) {
                        await db.set(
                            ["time", "username", userId],
                            username.toLowerCase(),
                        );
                    }
                    return `alright it's \`${offset_str(offset)}\` now`;
                } else {
                    const { value } = await db.get<number>([
                        "time",
                        "offset",
                        userId,
                    ]);
                    if (value === null) {
                        return "I DON'T KNOW";
                    } else {
                        return `yeah sure it's uhhhhh \`${offset_str(value)}\``;
                    }
                }
            },
            async username(val) {
                if (val) {
                    if (
                        val.match(
                            /times|time|offset|friends|friend|utc|[`"'&,;]/,
                        )
                    ) {
                        return "bad. sorry";
                    } else {
                        await db.set(["time", "username", userId], val);
                        return `alright it's \`${val}\` now`;
                    }
                } else {
                    const { value } = await db.get<string>([
                        "time",
                        "username",
                        userId,
                    ]);
                    if (value === null) {
                        return "I DON'T KNOW";
                    } else {
                        return `your time username is \`${value}\``;
                    }
                }
            },
            async delete() {
                await Promise.all([
                    db.delete(["time", "offset", userId]),
                    db.delete(["time", "username", userId]),
                ]);
                return "deleted";
            },
            async "admin-set"() {
                if (!isAdmin) return "you are not admin";

                const [userId, offset, username] = args.slice(1);
                await Promise.all([
                    db.set(["time", "offset", userId], Number.parseInt(offset)),
                    db.set(["time", "username", userId], username),
                ]);

                return "yes ma'am o7";
            },
        };

        if (!Object.keys(subcommands).includes(args[0])) {
            return `usage: \`time (${
                Object.keys(subcommands).toSorted().join("|")
            }) [val]\``;
        }

        const [subcommand, val] = args;
        return await subcommands[subcommand](val);
    },
    async xyimg(args, { username }) {
        try {
            // stack (top->bottom): h <s l a>
            const image = new Image(256, 256);
            for (let x = 0; x < image.width; x++) {
                for (let y = 0; y < image.height; y++) {
                    const src = [
                        `${x / (image.width - 1)}`,
                        "->x",
                        `${y / (image.height - 1)}`,
                        "->y",
                        ...args,
                    ];

                    const stack = await run({
                        args: src,
                        username,
                        depth: 0,
                    });

                    if (stack.length < 4) {
                        stack.unshift(
                            ...[1, 0.5, 1, 1].slice(0, 4 - stack.length),
                        );
                    }

                    const [a, l, s, h] = stack.slice(-4).map((v) =>
                        typeof v == "number" ? v : 0
                    );

                    // yes, it's one indexed. ????
                    image.setPixelAt(
                        x + 1,
                        y + 1,
                        Image.hslaToColor(h, s, l, a),
                    );
                }
            }
            return Buffer.from(await image.encode(3));
        } catch (err) {
            return err?.toString() ?? "what even is this error";
        }
    },
};

const admin_commands: string[] = ["clear", "dump", "die"];

const blue_role: RoleResolvable = "1392159642657755317";

const blue_seed = (): number => {
    const today = new Date();
    let seed = today.getUTCFullYear();
    seed *= 100;
    seed += today.getUTCMonth() + 1;
    seed *= 100;
    seed += today.getUTCDate();
    return seed;
};

const seed = () => prng.seed([blue_seed()]);
const pick = <T>(xs: T[]): T => xs[prng.int32() % xs.length];
const int = (lt: number): number => prng.int32() % lt;

const blue_letters: string[] = "etoaisnhrldum".split("");

function is_blue(message: string): boolean {
    seed();

    const length = 2 + int(3);
    const word = Array.from({ length }).map(() => pick(blue_letters)).join("");

    return message.toLowerCase().includes(word);
}

function is_unblue(message: string): boolean {
    seed();

    prng.cycle(10);

    const length = 2 + int(3);
    const word = Array.from({ length }).map(() => pick(blue_letters)).join("");

    return message.toLowerCase().includes(word);
}

client.on("messageCreate", async (message) => {
    if (is_blue(message.content)) {
        message.member?.roles.add(blue_role, "get blued");
    }
    if (is_unblue(message.content)) {
        message.member?.roles.remove(blue_role, "get unblued");
    }

    if (message.author.bot || !message.mentions.has(id)) return;

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
                    userId: message.author.id,
                    originalSrc: message.content,
                    isAdmin: is_admin,
                },
            );
            outputs.push(res);
        } else {
            const res = await commands.run(
                args,
                {
                    username: message.author.username,
                    userId: message.author.id,
                    originalSrc: message.content,
                    isAdmin: is_admin,
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

const home = (inner: string) => `
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script src="https://cdn.jsdelivr.net/npm/htmx.org@2.0.6/dist/htmx.min.js"></script>
    <title>puyo</title>
    <style>
        body {
            width: 100%;
            height: 100%;
            margin: 0;
            background-color: #1A1A1E;
        }
        #preview {
            width: min(50vh,100%);
            height: min(100vh, 200vw);
            border-collapse: collapse;
            aspect-ratio: 1/2;
            margin-inline: auto;
        }
        #preview > tbody > tr > td {
            border-radius: 8%;
        }
    </style>
</head>
<body>
    ${inner}
</body>
</html>
`;

async function offsets(): Promise<[number, ...string[]][]> {
    const out = new Map<number, string[]>();

    const entries = db.list<number>({ prefix: ["time", "offset"] });

    for await (const { key, value: offset } of entries) {
        const userId = key[2] as string;
        if (!out.has(offset)) out.set(offset, []);
        out.get(offset)!.push(userId);
    }

    const get_username = async (id: string) =>
        (await db.get<string>(["time", "username", id])).value ?? "UNKNOWN";

    const offsets = await Promise.all(
        out.entries().map(async (
            [offset, userIds],
        ): Promise<[number, ...string[]]> => [
            offset,
            ...(await Promise.all(userIds.map(get_username))).toSorted(),
        ]),
    );

    offsets.sort(([offset_a], [offset_b]) => offset_a - offset_b);

    return offsets;
}

const all_friends = async () =>
    (await offsets()).flatMap(([_offset, ...friends]) => friends);

const colors: [string, string][] = [
    // midnight
    ["white", "#000000"],
    ["white", "#030303"],
    ["white", "#060606"],
    ["white", "#090909"],
    ["white", "#0c0c0c"],
    ["white", "#0f0f0f"],
    // 6am
    ["white", "#131322"],
    ["white", "#1d1d39"],
    ["white", "#445168"],
    // 9am
    ["black", "#7998a4"],
    ["black", "#a1d9ee"],
    ["black", "#9ee4ff"],
    // noon
    ["black", "#8efdfd"],
    ["black", "#8ef7f7"],
    ["black", "#8ce8e8"],
    ["black", "#8de1e1"],
    ["black", "#8bd9d9"],
    ["black", "#8cd5d5"],
    // (implausibly long) sunset start
    ["black", "#C6DF9A"],
    ["black", "#ECCC5B"],
    ["white", "#BE5013"],
    // bright night
    ["white", "#1f1f25"],
    ["white", "#0f0f0e"],
    ["white", "#060609"],
];

const humanify_list = (xs: string[], { sep = "," } = {}): string => {
    let out = "";
    for (let i = 0; i < xs.length; i++) {
        const x = xs[i];
        const last = i + 1 >= xs.length;
        const second_to_last = i + 2 == xs.length;

        out += x;
        if (second_to_last) {
            if (xs.length > 2) out += sep;
            out += " and ";
        } else if (!last) {
            out += sep + " ";
        }
    }
    return out;
};

const offset_str = (offset: number): string =>
    `${(offset >= 0 ? "+" : "-")}${
        Math.abs(offset).toString().padStart(2, "0")
    }:00`;

const offset_info = (offset: number): { time: string; color: string } => {
    const now = new Date();

    const time = new Intl.DateTimeFormat("en-US", {
        timeStyle: "short",
        timeZone: offset_str(offset),
    }).format(now);

    const utc_hour = now.getUTCHours();
    let hour = (utc_hour + offset) % 24;
    if (hour < 0) hour += 24;

    const color = colors[hour][1];

    return { time, color };
};

const time_page = async (
    { update_bg, friends }: {
        update_bg: boolean;
        friends: string[];
    },
) => {
    let description = "local times of various m,caiers";
    let color = "#00091a";

    const offsets_ = await offsets();
    const all_friends_ = await all_friends();

    if (friends.length == 0) friends = all_friends_;

    if (friends.every((f) => all_friends_.includes(f))) {
        const groups = offsets_
            .map(([offset, ...fs]): [number, string[]] => [
                offset,
                fs.filter((f) => friends.includes(f)),
            ])
            .filter(([_offset, fs]) => fs.length > 0);

        const strs = groups.map(([offset, friends]) => {
            const { time, color: offset_color } = offset_info(offset);

            if (groups.length == 1) color = offset_color;

            return `${time} for ${humanify_list(friends)}`;
        });

        const sep = strs.some((s) => s.includes(",")) ? ";" : ",";

        description = `it is ${humanify_list(strs, { sep })}`;
    } else {
        description = "whoever made this link is very silly :3";
    }

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>m,cai time</title>
    <meta property="og:title" content="m,cai time">
    <meta name="theme-color" content="${color}" data-react-helmet="true">
    <meta name="description" content="${description}">
    <meta name="og:description" content="${description}">
    <style>
        body {
            width: 100%;
            height: 100%;
            margin: 0;
            background-color: #00091a;
            color: #c4a6d2;
            transition: color 1s, background-color 1s;
        }

        #times {
            list-style-type: none;
            text-align: right;
            width: min(50ch, 100%);
            margin-block: 0;
            margin-inline: auto;
            padding: 0;
        }

        .time {
            padding-block: 0.5rem;
            padding-inline: 0.5rem;
            transition: color 1s, background-color 1s;
            display: grid;
            grid-template:
                "offset friends"
                "offset time" / 3ch auto;
        }

        .offset {
            grid-area: offset;
            margin: 0;
            align-self: center;
            font-family: monospace;
            font-size: 11pt;
            text-align: left;
        }

        time {
            font-family: monospace;
            font-weight: bold;
            font-size: 11pt;
            grid-area: time;
        }

        .friends {
            list-style: none;
            grid-area: friends;
        }

        .friend {
            display: inline;
        }

        :target {
            outline: 5px solid white;
        }
    </style>
    <script>
        const offsets = ${JSON.stringify(offsets_)};
        const colors = ${JSON.stringify(colors)};

        let now = new Date();

        let update_bg = ${update_bg};

        const date_string_for = (offset) => new Intl.DateTimeFormat("en-US", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: (offset >= 0 ? "+" : "-") + Math.abs(offset).toString().padStart(2, "0") + ":00",
        }).format(now);

        function updateTime(time) {
            const utc_hour = now.getUTCHours();
            const datetime = time.querySelector("time");
            const offset = +time.dataset.offset;

            datetime.setAttribute("datetime", now.toISOString());
            datetime.innerText = date_string_for(offset);

            let hour = (utc_hour + offset) % 24;
            if (hour < 0) hour += 24;

            const [fg, bg] = colors[hour];

            time.style.color = fg;
            time.style.backgroundColor = bg;
        }

        window.addEventListener("DOMContentLoaded", () => {
            now = new Date();

            const times = document.getElementById("times");

            for (const [offset, ...friends] of offsets) {
                const time = document.createElement("li");
                time.dataset.offset = offset;
                time.setAttribute("id", "utc" + (offset >= 0 ? "+" : "") + offset.toString());
                time.classList.add("time");

                const offset_elem = document.createElement("p");
                offset_elem.classList.add("offset");
                offset_elem.innerText = (offset >= 0 ? "+" : "") + offset.toString();
                time.appendChild(offset_elem);

                const friends_list = document.createElement("ul");
                friends_list.classList.add("friends");

                for (let i = 0; i < friends.length; i++) {
                    const friend = friends[i];
                    const last = i + 1 >= friends.length;
                    const second_to_last = i + 2 == friends.length;

                    const friend_li = document.createElement("li");
                    friend_li.classList.add("friend");
                    friend_li.innerText = friend;
                    friend_li.setAttribute("id", friend);

                    friends_list.appendChild(friend_li);

                    if (!last) {
                        const sep = document.createElement("span");
                        sep.setAttribute("role", "presentation");

                        if (friends.length == 2) {
                            sep.innerText = " and ";
                        } else if (second_to_last) {
                            sep.innerText = ", and ";
                        } else {
                            sep.innerText = ", ";
                        }

                        friends_list.appendChild(sep);
                    }
                }

                time.appendChild(friends_list);

                time.appendChild(document.createElement("time"));

                updateTime(time);

                times.appendChild(time);
            }

            const update = () => {
                now = new Date();
                times.querySelectorAll("li.time").forEach(updateTime);
                if (update_bg) document.body.style.backgroundColor = colors[now.getHours()][1];
            };
            update();
            console.log(setInterval(update, 1000));
        });
    </script>
</head>
<body>
<ul id="times">
</ul>
</body>
</html>
`;
};

const flag_page = (colors: string[]): string => {
    const offsets = colors.map((_, i) => i / colors.length);

    const colors_godotified = colors.map((c) => {
        const channels = [c.slice(0, 2), c.slice(2, 4), c.slice(4, 6)].map(
            (x) => Number.parseInt(x, 16) / 255,
        );
        if (channels.some(Number.isNaN)) return `${c} is a fail`;
        return [...channels, 1];
    });

    return `[gd_scene load_steps=3 format=3 uid="uid://bym6ehk58ifyy"]

[sub_resource type="Gradient" id="Gradient_c35rn"]
interpolation_mode = 1
offsets = PackedFloat32Array(${offsets.join(", ")})
colors = PackedColorArray(${colors_godotified.flat().join(", ")})

[sub_resource type="GradientTexture2D" id="GradientTexture2D_yxws1"]
gradient = SubResource("Gradient_c35rn")
width = 1000
height = 600
fill_to = Vector2(0, 1)

[node name="Flag" type="CenterContainer"]
anchors_preset = -1
anchor_right = 0.561
anchor_bottom = 0.79
offset_right = -0.272034
offset_bottom = -511.92

[node name="TextureRect" type="TextureRect" parent="."]
layout_mode = 2
texture = SubResource("GradientTexture2D_yxws1")`;
};

Deno.serve(
    { port: 61200 },
    async (req) => {
        const is_htmx = req.headers.get("hx-request") == "true";
        const url = new URL(req.url);

        if (url.pathname == "/time") {
            const update_bg = url.searchParams.get("update-bg") !== null;
            const friends = url.searchParams.getAll("f");
            return new Response(
                await time_page({ update_bg, friends }),
                {
                    headers: { "content-type": "text/html" },
                },
            );
        }

        if (url.pathname == "/flag.tscn") {
            return new Response(flag_page(url.searchParams.getAll("c")), {
                headers: { "content-type": "application/x-godot-scene" },
            });
        }

        const table = await board.htmlStatus();
        return new Response(is_htmx ? table : home(table), {
            headers: { "content-type": "text/html" },
        });
    },
);
