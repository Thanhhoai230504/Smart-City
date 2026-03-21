const axios = require('axios');
const EnvironmentData = require('../models/EnvironmentData');
const cache = require('../utils/cache');

const DEFAULT_LOCATIONS = [
  { name: 'Quận Hải Châu, Đà Nẵng', lat: 16.0600, lon: 108.2208 },
  { name: 'Quận Thanh Khê, Đà Nẵng', lat: 16.0740, lon: 108.1860 },
  { name: 'Quận Sơn Trà, Đà Nẵng', lat: 16.1050, lon: 108.2510 },
  { name: 'Quận Ngũ Hành Sơn, Đà Nẵng', lat: 15.9940, lon: 108.2580 },
  { name: 'Quận Liên Chiểu, Đà Nẵng', lat: 16.0830, lon: 108.1510 },
  { name: 'Quận Cẩm Lệ, Đà Nẵng', lat: 16.0150, lon: 108.2060 },
  { name: 'Huyện Hòa Vang, Đà Nẵng', lat: 15.9800, lon: 108.1050 },
];

const getMockEnvironmentData = () => {
  return DEFAULT_LOCATIONS.map(loc => ({
    location: loc.name,
    source: 'Mock',
    temperature: Math.round((25 + Math.random() * 10) * 10) / 10,
    humidity: Math.round(60 + Math.random() * 30),
    weatherCondition: ['Clear', 'Clouds', 'Rain'][Math.floor(Math.random() * 3)],
    latitude: loc.lat,
    longitude: loc.lon
  }));
};

const getEnvironmentData = async () => {
  const CACHE_KEY = 'environment_data';
  const CACHE_TTL = 30 * 60 * 1000;

  const cachedData = cache.get(CACHE_KEY);
  if (cachedData) {
    return { environment: cachedData, source: 'cache', lastUpdated: new Date().toISOString() };
  }

  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    return {
      environment: getMockEnvironmentData(),
      source: 'mock',
      message: 'OpenWeatherMap API key not configured. Showing mock data.'
    };
  }

  const promises = DEFAULT_LOCATIONS.map(async (loc) => {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather`,
        {
          params: {
            lat: loc.lat, lon: loc.lon,
            appid: apiKey, units: 'metric', lang: 'vi'
          }
        }
      );

      const data = response.data;
      return {
        location: loc.name,
        source: 'OpenWeatherMap',
        temperature: Math.round(data.main.temp * 10) / 10,
        humidity: data.main.humidity,
        weatherCondition: data.weather[0].main,
        weatherDescription: data.weather[0].description,
        latitude: loc.lat,
        longitude: loc.lon,
        icon: data.weather[0].icon
      };
    } catch (err) {
      console.warn(`Failed to fetch weather for ${loc.name}:`, err.message);
      return null;
    }
  });

  const results = (await Promise.all(promises)).filter(Boolean);

  if (results.length > 0) {
    await EnvironmentData.insertMany(results.map(r => ({
      location: r.location, source: r.source,
      temperature: r.temperature, humidity: r.humidity,
      weatherCondition: r.weatherCondition,
      latitude: r.latitude, longitude: r.longitude
    })));
  }

  cache.set(CACHE_KEY, results, CACHE_TTL);

  return { environment: results, source: 'api', lastUpdated: new Date().toISOString() };
};

const getEnvironmentHistory = async ({ location, hours = 24 }) => {
  const filter = {
    createdAt: {
      $gte: new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000)
    }
  };
  if (location) filter.location = location;

  const history = await EnvironmentData.find(filter)
    .sort('-createdAt')
    .limit(100);

  return { history, total: history.length };
};

module.exports = { getEnvironmentData, getEnvironmentHistory };
