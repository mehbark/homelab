// TODO: randomly pick color
import { contentType } from "https://deno.land/std@0.202.0/media_types/mod.ts";
import {
    Image,
    TextLayout,
} from "https://deno.land/x/imagescript@1.2.15/ImageScript.js";

const font = await fetch("https://static.pyrope.net/courier-std-bold.otf")
    .then((r) => r.arrayBuffer())
    .then((b) => new Uint8Array(b));

function make_image(
    { text, color = 0, outline_color = 0xff_ff_ff_ff }: {
        text: string;
        color?: number;
        outline_color?: number;
    },
): Image {
    let image = Image.renderText(
        font,
        64,
        ` ${text} `,
        0,
        new TextLayout({ verticalAlign: "center", horizontalAlign: "middle" }),
    );

    const outline = Image.renderText(
        font,
        64,
        ` ${text} `,
        outline_color,
        new TextLayout({ verticalAlign: "center", horizontalAlign: "middle" }),
    );

    for (const hshift of [-2, 0, 2]) {
        for (const vshift of [-2, 0, 2]) {
            image = image.composite(outline, hshift, vshift);
        }
    }
    const text_img = Image.renderText(
        font,
        64,
        ` ${text} `,
        color,
        new TextLayout({ verticalAlign: "center", horizontalAlign: "middle" }),
    );

    const final = image.composite(text_img);
    return final.crop(36, 0, final.width - 35, final.height - 16);
}

// the whole cache thing def sketches me out, but people probably won't be *that* malicious
const MAX_PRN_LENGTH = 128;
// shouldn't really be a problem
const MAX_PRN_CHOICES = 256;

// let's stick to hex even though BigInt() can handle prefixes (prefices?)
const hex_string_to_color = (s: string): number | undefined => {
    const parsed = parseInt(s, 16);
    if (Number.isNaN(parsed)) return;
    // JANK! SORRY
    return Number((BigInt(parsed) << 8n) | 0xffn);
};

const image_response = (data: Uint8Array): Response =>
    new Response(data, {
        headers: { "Content-Type": contentType("png") },
    });

Deno.serve({ port: 61265 }, async (req) => {
    const url = new URL(req.url);
    const params = url.searchParams;
    const prns = params.getAll("p");

    if (prns.some((p) => p.length > MAX_PRN_LENGTH)) {
        return new Response(`MAX_PRN_LENGTH = ${MAX_PRN_LENGTH}`, {
            status: 413,
        });
    }

    if (prns.length > MAX_PRN_CHOICES) {
        return new Response(`MAX_PRN_CHOICES = ${MAX_PRN_CHOICES}`, {
            status: 413,
        });
    }

    const prn = prns[Math.floor(Math.random() * prns.length)] ??
        "NONE, APPARENTLY";

    const fg_str = params.get("fg");
    const outline_str = params.get("outline");

    const sentence_id = params.get("sentence_id");
    const sentence_index = params.get("sentence_index");

    console.log(
        `${sentence_id}#${sentence_index}: chose ${prn} from ${prns}. ${fg_str} on ${outline_str}`,
    );

    const fg = hex_string_to_color(fg_str ?? "0");
    const outline = hex_string_to_color(outline_str ?? "ffffff");

    const resp = image_response(
        await make_image({ text: prn, color: fg, outline_color: outline })
            .encode(),
    );
    return resp;
});
