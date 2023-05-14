const express = require("express");
const cors = require("cors");
const routeCache = require("route-cache");
const axios = require("axios");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY;

app.use(express.static("public"));
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});

app.get("/test", (req, res) => {
  const lat = req.query.lat;
  const lon = req.query.lon;
  console.log(`lat: ${lat}, lon: ${lon}`);
  axios
    .get(
      `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly&units=metric&appid=${API_KEY}`
    )
    .then((response) => {
      const t = response.data.daily[0];
      const m = response.data.daily[1];
      const today = {
        pressure: t.pressure,
        temp: t.temp.day,
        nightTemp: t.temp.night,
        minTemp: t.temp.min,
        humidity: t.humidity,
      };
      const time = new Date(m.dt).toISOString();
      const tomorrow = {
        pressure: m.pressure,
        temp: m.temp.day,
        mornTemp: m.temp.morn,
        minTemp: m.temp.min,
        humidity: m.humidity,
        dew_point: m.dew_point,
      };
      const frostRisk = calculateFrostRisk(today, tomorrow);
      res.json({ frostRisk, today, tomorrow, time, t, m });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send("Unable to get weather data");
    });
});

app.get("/weather", routeCache.cacheSeconds(7200), (req, res) => {
  const lat = req.query.lat;
  const lon = req.query.lon;
  console.log(`lat: ${lat}, lon: ${lon}`);
  axios
    .get(
      `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly&units=metric&appid=${API_KEY}`
    )
    .then((response) => {
      const t = response.data.daily[0];
      const m = response.data.daily[1];
      const today = {
        tpressure: t.pressure,
        ttemp: t.temp.day,
        nightTemp: t.temp.night,
        tminTemp: t.temp.min,
        thumidity: t.humidity,
      };
      const time = new Date(m.dt * 1000);
      const tomorrow = {
        mpressure: m.pressure,
        mtemp: m.temp.day,
        mornTemp: m.temp.morn,
        mminTemp: m.temp.min,
        mhumidity: m.humidity,
        dew_point: m.dew_point,
      };
      const frostRisk = calculateFrostRisk(today, tomorrow);
      const riskDescription = getRiskDescription(frostRisk, time);
      res.json({ frostRisk, riskDescription });
    })
    .catch((error) => {
      console.log(error);
      res.status(500).send("Unable to get weather data");
    });
});

function calculateFrostRisk(today, tomorrow) {
  const { tpressure, ttemp, nightTemp, tminTemp, thumidity } = today;
  const { mpressure, mtemp, mornTemp, mminTemp, mhumidity, dew_point } =
    tomorrow;

  let risk = 0;

  soiltemp = (ttemp + nightTemp) / 2;

  if (mornTemp < 4 || mminTemp < 4) {
    risk += 20 * (4 - mornTemp);
  }

  if (soiltemp < 2) {
    risk += 20 * (2 - soiltemp);
  } else if (soiltemp > 4) {
    risk -= 20 * (soiltemp - 4);
  }

  if (mornTemp < dew_point) {
    risk *= 1.2;
  }

  risk = (risk * ((mpressure + tpressure) / 2)) / 1013;

  if (risk > 100) {
    risk = 100;
  } else if (risk < 0) {
    risk = 0;
  }

  return risk;
}

function getRiskDescription(frostRisk, time) {
  msg = "";

  if (frostRisk <= 20) {
    msg += "Low Risk of Frost";
  } else if (frostRisk <= 50) {
    msg += "Moderate Risk of Frost";
  } else if (frostRisk <= 70) {
    msg += "High Risk of Frost";
  } else {
    msg += "Very High Risk of Frost";
  }

  msg += " for morning " + time.toISOString().slice(0, 10);

  return msg;
}

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
