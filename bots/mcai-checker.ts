import { Client, Events, GatewayIntentBits } from "npm:discord.js";
import { levenshteinEditDistance } from "npm:levenshtein-edit-distance";
import { Diff } from "npm:diff";

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

const correct = "man, computers are incredible";
const birds =
    `🦃 🐔 🐓 🐣 🐤 🐥 🐦 🐧 🕊️ 🦅 🦆 🦢 🦉 🦤 🪶 🦩 🦚 🦜 🪽 🐦‍⬛ 🪿 🐦‍🔥`
        .split(" ");

const c_id = "397120199897120769";

client.on("messageCreate", (message) => {
    if (message.author.id == id) return;

    if (message.author.id == c_id) {
        if (
            Math.random() < 0.05 ||
            /bir|tweet|hoo|chirp|trill|warble|caw|coo|squawk/i.test(message.content)
        ) {
            message.react(birds[Math.floor(Math.random() * birds.length)]);
        }
    }

    if (message.content == "man, computers are interesting") {
        if (message.author.id == c_id) {
            message.reply("<:widesmile:1111490825252253706>");
        } else {
            message.reply("YOU ARE NOT CEFQRN! D:<");
        }
        return;
    }

    if (is_mcai_like(message.content) && is_malformed(message.content)) {
        if (message.content.indexOf("@") >= 0) {
            message.react("😡");
            for (const c of "UNOTRICKME") {
                message.react(
                    String.fromCodePoint(
                        c.codePointAt(0) as number - 65 + 0x1f1e6,
                    ),
                );
            }
            return;
        }

        if (message.content.length > 256) {
            message.reply(
                "it's `man, computers are incredible`. i'd go into more detail about how wrong you were, but your message was too long. how did this even happen?",
            );
            return;
        }

        const d = new Diff();

        let reply =
            "you messed up. it's `man, computers are incredible`. here's how to fix it: ```diff\n";
        for (const chunk of d.diff(correct, message.content)) {
            for (const c of chunk.value) {
                reply += `${chunk.added ? "-" : chunk.removed ? "+" : " "} ${
                    char_bstring(c as string)
                } ${JSON.stringify(c).slice(1, -1)}\n`;
            }
        }
        reply += "```\ngot it? let's do better next time, okay?";
        if (Math.random() < 0.01) {
            reply +=
                "\ni love you. i love you. i love you. i love you. i love you. i love you. i love you. i lo";
        }

        message.reply(reply);
    }
});

function char_bstring(c: string) {
    return c ? c.charCodeAt(0).toString(16).padStart(6, "0") : "000000";
}

/* OOD
const right = "\x1b[0;32m";
const wrong = "\x1b[1;31m";
const reset = "\x1b[0m"

function char_pair(exp, got) {
    return `${exp===got?right:wrong}${exp === got ? "right" : "WRONG"}${reset}\t${char_bstring(exp)}\t${exp===got?"":wrong}${char_bstring(got)}${reset}\t${exp??" "}\t${exp===got?"":wrong}${got??" "}${reset}`;
}
*/

function is_mcai_like(str: string) {
    const normalized = str.normalize("NFKD").toLowerCase().replace(
        /[^a-z]/g,
        "",
    );
    const target = "mancomputersareincredible";
    return (
        levenshteinEditDistance(normalized, target) <= 10
    );
}

function is_malformed(str: string) {
    return str != correct;
}
