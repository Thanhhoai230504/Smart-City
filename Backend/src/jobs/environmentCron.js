const cron = require('node-cron');
const axios = require('axios');
const EnvironmentData = require('../models/EnvironmentData');

// Da Nang area monitoring locations
const DEFAULT_LOCATIONS = [
  { name: 'Quận Hải Châu, Đà Nẵng', lat: 16.0544, lon: 108.2022 },
  { name: 'Quận Thanh Khê, Đà Nẵng', lat: 16.0678, lon: 108.1837 },
  { name: 'Quận Sơn Trà, Đà Nẵng', lat: 16.1100, lon: 108.2478 },
  { name: 'Quận Ngũ Hành Sơn, Đà Nẵng', lat: 16.0194, lon: 108.2478 },
  { name: 'Quận Liên Chiểu, Đà Nẵng', lat: 16.0717, lon: 108.1500 }
];

/**
 * Fetch environment data from OpenWeatherMap and save to MongoDB
 * Called by cron job every 30 minutes
 */
const fetchAndSaveEnvironmentData = async () => {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey) {
    console.log('⏭️  Environment cron: Skipped (no API key configured)');
    return;
  }

  console.log('🌡️  Environment cron: Fetching data...');

  try {
    const promises = DEFAULT_LOCATIONS.map(async (loc) => {
      try {
        const response = await axios.get(
          'https://api.openweathermap.org/data/2.5/weather',
          {
            params: {
              lat: loc.lat,
              lon: loc.lon,
              appid: apiKey,
              units: 'metric',
              lang: 'vi'
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
          latitude: loc.lat,
          longitude: loc.lon
        };
      } catch (err) {
        console.warn(`  ⚠️  Failed for ${loc.name}: ${err.message}`);
        return null;
      }
    });

    const results = (await Promise.all(promises)).filter(Boolean);

    if (results.length > 0) {
      await EnvironmentData.insertMany(results);
      console.log(`  ✅ Saved ${results.length} records to database`);
    } else {
      console.warn('  ⚠️  No data fetched from API');
    }
  } catch (error) {
    console.error('  ❌ Environment cron error:', error.message);
  }
};

/**
 * Start the environment data cron job
 * Runs every 30 minutes: "0,30 * * * *"
 */
const startEnvironmentCron = () => {
  // Run every 30 minutes
  cron.schedule('0,30 * * * *', () => {
    fetchAndSaveEnvironmentData();
  });

  console.log('⏰ Environment data cron job scheduled (every 30 minutes)');

  // Also fetch immediately on startup to have initial data
  fetchAndSaveEnvironmentData();
};

module.exports = { startEnvironmentCron, fetchAndSaveEnvironmentData };
