import PixelPusher from "node-pixel-pusher";
import nodeCanvas, { loadImage } from "canvas";
import fetch from "node-fetch";
import moment from "moment";
import dotenv from "dotenv";

dotenv.config();

const MAX_FPS = 30;

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

function createRenderer(device) {
  const width = device.deviceData.pixelsPerStrip;
  const height = device.deviceData.numberStrips;
  const canvas = nodeCanvas.createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  let image;
  let weather;

  console.log(`Creating renderer ${width}x${height} ${MAX_FPS}fps`);

  const getNowPlayingImage = async () => {
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${process.env.LASTFM_USER}&api_key=${process.env.LASTFM_KEY}&format=json&limit=1`
    );
    const json = await res.json();

    const lastSong = json.recenttracks?.track?.[0];
    if (lastSong?.["@attr"]?.nowplaying) {
      const largestImage = lastSong.image?.pop();
      const imageUrl = largestImage?.["#text"];
      image = await loadImage(imageUrl);
    } else {
      image = undefined;
    }
  };

  const getWeather = async () => {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${process.env.WEATHER_LAT}&longitude=${process.env.WEATHER_LON}&current_weather=true`
    );
    const json = await res.json();
    const weatherString = getWmoString(json.current_weather.weathercode);
    const weatherIcon = await loadImage(
      `./src/svg/${weatherString.toLowerCase()}.svg`
    );
    weather = { ...json.current_weather, icon: weatherIcon };
  };

  getNowPlayingImage();
  getWeather();
  setInterval(getNowPlayingImage, 15000);
  setInterval(getWeather, 5 * 60000);

  device.startRendering(() => {
    if (image) {
      ctx.drawImage(image, 0, 0, width, height);
    } else {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "white";
      ctx.font = "11px monospace";
      ctx.fillText(moment().format("ddd Do"), 4, 11);
      ctx.fillText(moment().format("HH:mm:ss"), 4, 22);

      if (weather) {
        ctx.drawImage(weather.icon, 4, 28, 18, 18);
        ctx.fillText(`${weather.temperature}°C`, 25, 40);
      }
    }
    const ImageData = ctx.getImageData(0, 0, width, height);
    device.setRGBABuffer(ImageData.data);
  }, MAX_FPS);
}

const service = new PixelPusher.Service();

service.on("discover", (device) => {
  createRenderer(device);
});
