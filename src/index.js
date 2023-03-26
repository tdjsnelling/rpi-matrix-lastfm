import PixelPusher from "node-pixel-pusher";
import nodeCanvas, { loadImage, registerFont } from "canvas";
import fetch from "node-fetch";
import moment from "moment-timezone";
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

registerFont("./src/font/Monaco.ttf", { family: "Monaco" });

async function createRenderer(device) {
  const width = device.deviceData.pixelsPerStrip;
  const height = device.deviceData.numberStrips;
  const canvas = nodeCanvas.createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  let image;
  let weather;

  const downIcon = await loadImage("./src/svg/down.svg");

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
    const weatherDate = moment().tz("Europe/London").format("YYYY-MM-DD");
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${process.env.WEATHER_LAT}&longitude=${process.env.WEATHER_LON}&current_weather=true&daily=sunrise,sunset&timezone=auto&start_date=${weatherDate}&end_date=${weatherDate}`
    );
    const json = await res.json();
    weather = { ...json.current_weather, sunset: json.daily.sunset[0] };
    const weatherString = getWmoString(weather.weathercode);
    if (weatherString === "Clear") {
      if (
        moment().tz("Europe/London") >
        moment(weather.sunset).tz("Europe/London")
      ) {
        weather.icon = await loadImage(`./src/svg/moon.svg`);
      } else if (weather.temperature > 14) {
        weather.icon = await loadImage(`./src/svg/clear.svg`);
      } else {
        weather.icon = await loadImage(`./src/svg/clear-nosun.svg`);
      }
    } else {
      weather.icon = await loadImage(
        `./src/svg/${weatherString.toLowerCase()}.svg`
      );
    }
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
      ctx.font = "11px Monaco";
      ctx.fillText(moment().tz("Europe/London").format("ddd Do"), 4, 13);
      ctx.fillText(moment().tz("Europe/London").format("HH:mm:ss"), 4, 25);

      if (weather) {
        ctx.font = "9px Monaco";
        ctx.drawImage(weather.icon, 4, 28, 15, 15);
        ctx.fillText(`${weather.temperature}°C`, 22, 39);
        ctx.drawImage(downIcon, 5, 44, 10, 10);
        ctx.fillText(
          moment(weather.sunset).tz("Europe/London").format("HH:mm"),
          17,
          53
        );
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
