import PixelPusher from "node-pixel-pusher";
import nodeCanvas, { loadImage, registerFont } from "canvas";
import fetch from "node-fetch";
import dotenv from "dotenv";
import moment from "moment-timezone";

dotenv.config();

const MAX_FPS = 24;
const SCROLL_SPEED_PX_PER_SEC = 8; // tweak for taste
const REM = 16;
const FONT = `${REM * 1}px Pixel`

registerFont("./src/font/m3x6.ttf", { family: "Pixel" });

const getWmoString = (code) => {
    switch (code) {
        case 0:
        case 1:
            return "Clear";
        case 2:
            return "Cloudy";
        case 3:
            return "Overcast";
        case 45:
        case 48:
            return "Fog";
        case 51:
        case 53:
        case 55:
        case 56:
        case 57:
            return "Drizzle";
        case 61:
        case 63:
        case 65:
        case 66:
        case 67:
        case 80:
        case 81:
        case 82:
            return "Rain";
        case 71:
        case 73:
        case 75:
        case 77:
        case 85:
        case 86:
            return "Snow";
        case 95:
        case 96:
        case 99:
            return "Storms";
        default:
            return "";
    }
};

async function createRenderer(device) {
    const width = device.deviceData.pixelsPerStrip;
    const height = device.deviceData.numberStrips;
    const canvas = nodeCanvas.createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.antialias = "none";

    function getCentredOffset(text) {
        const m = ctx.measureText(text);
        return Math.floor((width - m.width) / 2);
    }

    let image, artist = "", album = "", song = "";
    let trackId = ""; // used to detect song changes

    let weather;

    const spotifyIcon = await loadImage(
        `./src/svg/spotify.svg`
    );

    // text layout
    const xStart = 2; // 2px pad
    const availWidth = Math.max(0, width - xStart - 2);
    const lines = [
        { key: "song",   y: 42, text: "", width: 0, offset: 0, dir: -1, pause: 0 },
        { key: "artist", y: 52, text: "", width: 0, offset: 0, dir: -1, pause: 0 },
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
            line.pause = 3; // pause at start
        }
    }

    console.log(`Creating renderer ${width}x${height} ${MAX_FPS}fps`);

    async function getNowPlayingImage() {
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
                trackId = undefined;
                image = undefined;
                // keep prior text untouched; or blank them if you prefer:
                artist = album = song = ""; syncLines();
            }
        } catch (e) {
            // fail quiet; keep previous frame
        }
    }

    async function getWeather() {
        const weatherDate = moment().tz("Europe/London").format("YYYY-MM-DD");
        const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${process.env.WEATHER_LAT}&longitude=${process.env.WEATHER_LON}&current_weather=true&daily=sunrise,sunset&timezone=auto&start_date=${weatherDate}&end_date=${weatherDate}`
        );
        const json = await res.json();
        weather = { ...json.current_weather, str: getWmoString(json.current_weather.weathercode) };
    }

    await getNowPlayingImage();
    setInterval(getNowPlayingImage, 15000);

    await getWeather();
    setInterval(getWeather, 5 * 60000);

    let lastTs = Date.now();

    device.startRendering(() => {
        const now = Date.now();
        const dt = Math.min(0.25, (now - lastTs) / 1000); // clamp dt
        lastTs = now;

        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);

        // draw text with marquee when too wide
        ctx.fillStyle = "white";
        ctx.font = FONT;

        if (image) {
            ctx.drawImage(image, 2, 2, 32, 32);
            ctx.drawImage(spotifyIcon, 41, 10, 16, 16);

            for (const line of lines) {
                if (!line.text) continue;
                const needsScroll = line.width > availWidth;

                if (needsScroll) {
                    const x = xStart - Math.floor(line.offset);

                    if (line.pause > 0) {
                        line.pause -= dt;
                        // keep text fixed at start position
                        ctx.fillText(line.text, x, line.y);
                        continue;
                    }

                    // update offset
                    line.offset += line.dir * SCROLL_SPEED_PX_PER_SEC * dt;
                    const maxOffset = line.width - availWidth;

                    if (line.offset <= 0) {
                        line.offset = 0;
                        line.dir = 1;
                        line.pause = 3; // pause again at start
                    } else if (line.offset >= maxOffset) {
                        line.offset = maxOffset;
                        line.dir = -1;
                        line.pause = 3
                    }

                    ctx.fillText(line.text, x, line.y);
                } else {
                    ctx.fillText(line.text, xStart, line.y);
                }
            }
        } else {
            ctx.strokeStyle = "#e62802";
            ctx.strokeRect(1, 1, width - 1, height - 1);

            ctx.font = `${REM * 2}px Pixel`;
            const timeStr = moment().tz("Europe/London").format("HH:mm");
            const timeStrX = getCentredOffset(timeStr);
            ctx.fillText(timeStr, timeStrX, 28);

            ctx.font = FONT;
            const dateStr = moment().tz("Europe/London").format("ddd Do MMM");
            const dateStrX = getCentredOffset(dateStr);
            ctx.fillText(dateStr, dateStrX, 38);

            if (weather) {
                const weatherStr = `${parseInt(weather.temperature)}°C ${weather.str}`;
                const weatherStrX = getCentredOffset(weatherStr);
                ctx.fillText(weatherStr, weatherStrX, 48);
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
