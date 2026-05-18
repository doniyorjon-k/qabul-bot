export default () => ({
  bot: {
    token: process.env.BOT_TOKEN,
    adminIds: (process.env.ADMIN_IDS || '').split(',').map(Number).filter(Boolean),
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    name: process.env.DB_NAME || 'qabulbot',
  },
  clinic: {
    name: process.env.CLINIC_NAME || 'Smile Dental',
    address: process.env.CLINIC_ADDRESS || 'Toshkent sh, Chilonzor tumani',
    phone: process.env.CLINIC_PHONE || '+998901234567',
    telegram: process.env.CLINIC_TELEGRAM || '@smiledentaluz',
    mapsUrl: process.env.CLINIC_MAPS_URL || '',
  },
  webhook: {
    url: process.env.WEBHOOK_URL || '',
    port: parseInt(process.env.WEBHOOK_PORT, 10) || 3000,
  },
  nodeEnv: process.env.NODE_ENV || 'development',
});
