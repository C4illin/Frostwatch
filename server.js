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
  const lang = req.query.lang || "en";
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
      const riskDescription = getRiskDescription(frostRisk, time, lang);
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

  // Modify risk by addition or subtraction
  if (mornTemp < 4 || mminTemp < 4) {
    risk += 20 * (4 - mornTemp);
  }

  if (soiltemp < 2) {
    risk += 20 * (2 - soiltemp);
  } else if (soiltemp > 6) {
    risk -= 20 * (soiltemp - 6);
  }

  // Modify risk by multiplication
  if (mornTemp < dew_point) {
    risk = risk * 1.2;
  } else {
    risk = risk * 0.8;
  }

  if (mpressure && tpressure) {
    risk = risk * ((mpressure + tpressure) / 2 / 1013);
  }

  if (mhumidity > 80) {
    risk = risk * (mhumidity / 80) * 1.2;
  }

  if (risk > 100) {
    risk = 100;
  } else if (risk < 0) {
    risk = 0;
  }

  risk = Math.round(risk);
  return risk;
}

function getRiskDescription(frostRisk, time, lang) {
  msg = "";
  if (frostRisk <= 20) {
    msg += tl("Low Risk of Frost", lang);
  } else if (frostRisk <= 50) {
    msg += tl("Moderate Risk of Frost", lang);
  } else if (frostRisk <= 70) {
    msg += tl("High Risk of Frost", lang);
  } else {
    msg += tl("Very High Risk of Frost", lang);
  }
  msg += ` ${tl("for Morning", lang)} ${time.toISOString().slice(0, 10)}`;
  return msg;
}

function tl(text, lang) {
  switch (lang) {
    case "en":
      return text;
    case "sv":
      if (text === "Low Risk of Frost") {
        return "Låg risk för frost";
      }
      if (text === "Moderate Risk of Frost") {
        return "Måttlig risk för frost";
      }
      if (text === "High Risk of Frost") {
        return "Hög risk för frost";
      }
      if (text === "Very High Risk of Frost") {
        return "Mycket hög risk för frost";
      }
      if (text === "for Morning") {
        return "morgonen";
      }
    default:
      return text;
  }
}

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
