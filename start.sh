sudo docker run -d \
  --name matrix \
  --network host \
  -e LASTFM_USER=tdjsnelling -e LASTFM_KEY=efb1c4959521f2452a8755f7ea6c9d9d \
  -e WEATHER_LAT=51.7 -e WEATHER_LON=-1.5 \
  --restart on-failure \
  rpi-matrix-lastfm:new
