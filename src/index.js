import PixelPusher from "node-pixel-pusher";
import nodeCanvas, { loadImage } from "canvas";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const MAX_FPS = 30;

function createRenderer(device) {
  const width = device.deviceData.pixelsPerStrip;
  const height = device.deviceData.numberStrips;
  const canvas = nodeCanvas.createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  let image;

  console.log(`Creating renderer ${width}x${height} ${MAX_FPS}fps`);

  const getImage = async () => {
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${process.env.LASTFM_USER}&api_key=${process.env.LASTFM_KEY}&format=json&limit=1`
    );
    const json = await res.json();

    const lastSong = json.recenttracks.track[0];
    if (lastSong["@attr"]?.nowplaying) {
      const largestImage = lastSong.image.pop();
      const imageUrl = largestImage["#text"];
      image = await loadImage(imageUrl);
    } else {
      image = undefined;
    }
  };

  getImage();
  setInterval(getImage, 15000);

  device.startRendering(() => {
    if (image) {
      ctx.drawImage(image, 0, 0, width, height);
    } else {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, width, height);
    }
    const ImageData = ctx.getImageData(0, 0, width, height);
    device.setRGBABuffer(ImageData.data);
  }, MAX_FPS);
}

const service = new PixelPusher.Service();

service.on("discover", (device) => {
  createRenderer(device);
});
