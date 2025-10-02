import PixelPusher from "node-pixel-pusher";
import nodeCanvas, { loadImage, registerFont } from "canvas";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const MAX_FPS = 30;

registerFont("./src/font/m5x7.ttf", { family: "Pixel" });

async function createRenderer(device) {
  const width = device.deviceData.pixelsPerStrip;
  const height = device.deviceData.numberStrips;
  const canvas = nodeCanvas.createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.antialias = 'none';

  let image, artist, album, song;

  console.log(`Creating renderer ${width}x${height} ${MAX_FPS}fps`);

  const getNowPlayingImage = async () => {
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${process.env.LASTFM_USER}&api_key=${process.env.LASTFM_KEY}&format=json&limit=1`
    );
    const json = await res.json();

    const lastSong = json.recenttracks?.track?.[0];
    if (lastSong?.["@attr"]?.nowplaying) {
      console.log(lastSong)
      const largestImage = lastSong.image?.pop();
      const imageUrl = largestImage?.["#text"];
      image = await loadImage(imageUrl);

      artist = lastSong.artist['#text'];
      album = lastSong.album['#text'];
      song = lastSong.name;
    } else {
      image = undefined;
    }
  };

  await getNowPlayingImage();
  setInterval(getNowPlayingImage, 15000);

  device.startRendering(() => {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, height);

    if (image) {
      ctx.drawImage(image, 2, 2, 32, 32);

      ctx.fillStyle = "white";
      ctx.font = "16px Pixel";
      ctx.fillText(song, 2, 44);
      ctx.fillText(artist, 2, 53);
      ctx.fillText(album, 2, 62);
    } else {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, width, height);
    }

    const ImageData = ctx.getImageData(0, 0, width, height);
    device.setRGBABuffer(ImageData.data);
  }, MAX_FPS);
}

const service = new PixelPusher.Service();

service.on("discover", async (device) => {
  await createRenderer(device);
});
