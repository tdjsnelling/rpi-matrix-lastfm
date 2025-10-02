import PixelPusher from "node-pixel-pusher";
import nodeCanvas, { loadImage, registerFont } from "canvas";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const MAX_FPS = 30;
const SCROLL_SPEED_PX_PER_SEC = 8; // tweak for taste
const FONT = '16px Pixel'

registerFont("./src/font/m5x7.ttf", { family: "Pixel" });

async function createRenderer(device) {
    const width = device.deviceData.pixelsPerStrip;
    const height = device.deviceData.numberStrips;
    const canvas = nodeCanvas.createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.antialias = "none";

    let image, artist = "", album = "", song = "";
    let trackId = ""; // used to detect song changes

    // text layout
    const xStart = 2; // 2px pad
    const availWidth = Math.max(0, width - xStart - 2);
    const lines = [
        { key: "song",   y: 44, text: "", width: 0, offset: 0, dir: -1, pause: 0 },
        { key: "artist", y: 53, text: "", width: 0, offset: 0, dir: -1, pause: 0 },
        { key: "album",  y: 62, text: "", width: 0, offset: 0, dir: -1, pause: 0 },
    ];

    function syncLines() {
        ctx.font = FONT;
        lines[0].text = song || "";
        lines[1].text = artist || "";
        lines[2].text = album || "";

        for (const line of lines) {
            const m = ctx.measureText(line.text || "");
            line.width = Math.ceil(m.width);
            line.offset = 0;
            line.dir = -1; // start scrolling left
            line.pause = 5; // pause at start
        }
    }

    console.log(`Creating renderer ${width}x${height} ${MAX_FPS}fps`);

    const getNowPlayingImage = async () => {
        try {
            const res = await fetch(
                `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${process.env.LASTFM_USER}&api_key=${process.env.LASTFM_KEY}&format=json&limit=1`
            );
            const json = await res.json();

            const lastSong = json.recenttracks?.track?.[0];
            if (lastSong?.["@attr"]?.nowplaying) {
                const largestImage = lastSong.image?.slice(-1)?.[0];
                const imageUrl = largestImage?.["#text"];

                const nextArtist = lastSong.artist?.["#text"] ?? "";
                const nextAlbum = lastSong.album?.["#text"] ?? "";
                const nextSong = lastSong.name ?? "";
                const nextId = `${nextArtist}|||${nextAlbum}|||${nextSong}`;

                if (nextId !== trackId) {
                    trackId = nextId;
                    artist = nextArtist;
                    album = nextAlbum;
                    song = nextSong;

                    image = imageUrl ? await loadImage(imageUrl) : undefined;
                    syncLines();
                }
            } else {
                image = undefined;
                // keep prior text untouched; or blank them if you prefer:
                artist = album = song = ""; syncLines();
            }
        } catch (e) {
            // fail quiet; keep previous frame
        }
    };

    await getNowPlayingImage();
    setInterval(getNowPlayingImage, 15000);

    let lastTs = Date.now();

    device.startRendering(() => {
        const now = Date.now();
        const dt = Math.min(0.25, (now - lastTs) / 1000); // clamp dt
        lastTs = now;

        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);

        if (image) {
            ctx.drawImage(image, 2, 2, 32, 32);
        }

        // draw text with marquee when too wide
        ctx.fillStyle = "white";
        ctx.font = FONT;

        for (const line of lines) {
            if (!line.text) continue;
            const needsScroll = line.width > availWidth;

            if (needsScroll) {
                if (line.pause > 0) {
                    line.pause -= dt;
                    // keep text fixed at start position
                    ctx.fillText(line.text, xStart, line.y);
                    continue;
                }

                // update offset
                line.offset += line.dir * SCROLL_SPEED_PX_PER_SEC * dt;
                const maxOffset = line.width - availWidth;

                if (line.offset <= 0) {
                    line.offset = 0;
                    line.dir = 1;
                    line.pause = 5; // pause again at start
                } else if (line.offset >= maxOffset) {
                    line.offset = maxOffset;
                    line.dir = -1;
                    // no pause at far right, only at start
                }

                const x = xStart - Math.floor(line.offset);
                ctx.fillText(line.text, x, line.y);
            } else {
                ctx.fillText(line.text, xStart, line.y);
            }
        }

        const ImageData = ctx.getImageData(0, 0, width, height);
        device.setRGBABuffer(ImageData.data);
    }, MAX_FPS);
}

const service = new PixelPusher.Service();

service.on("discover", async (device) => {
    await createRenderer(device);
});
