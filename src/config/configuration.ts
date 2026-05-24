export default () => ({
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    name: process.env.DB_NAME || 'qabulbot',
  },
  app: {
    url: process.env.APP_URL || process.env.WEBHOOK_URL || '',
  },
  superAdmin: {
    botToken: process.env.SUPER_ADMIN_BOT_TOKEN || '',
    ids: (process.env.SUPER_ADMIN_IDS || '').split(',').map(Number).filter(Boolean),
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  // Legacy single-clinic env vars used only for initial seed in ClinicsService.onModuleInit
  bot: {
    token: process.env.BOT_TOKEN || '',
    adminIds: (process.env.ADMIN_IDS || '').split(',').map(Number).filter(Boolean),
  },
});
