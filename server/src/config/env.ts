import Joi from 'joi';

const envSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().required(),
  CLIENT_URL: Joi.string().uri().required(),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  CROSS_SITE_COOKIES: Joi.boolean().truthy('true').falsy('false').default(false),
  TRUST_PROXY: Joi.string().allow('').default(''),
  MONGO_URI: Joi.string().uri({ scheme: ['mongodb', 'mongodb+srv'] }).required(),
  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ISSUER: Joi.string().default('blackbook.ai'),
  JWT_AUDIENCE: Joi.string().default('blackbook.ai-api'),
  EMAIL_HOST: Joi.string().allow('').default(''),
  EMAIL_PORT: Joi.number().port().default(587),
  EMAIL_USER: Joi.string().required(),
  EMAIL_PASS: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().default('no-reply@example.com'),
}).unknown(true);

const { error, value } = envSchema.validate(process.env, {
  abortEarly: false,
  convert: true,
});

if (error) {
  const message = error.details.map((detail) => detail.message).join('; ');
  throw new Error(`Invalid environment configuration: ${message}`);
}

const corsOrigins = [
  value.CLIENT_URL,
  ...String(value.CORS_ORIGINS)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
];

export const env = {
  nodeEnv: value.NODE_ENV as 'development' | 'test' | 'production',
  port: Number(value.PORT),
  clientUrl: String(value.CLIENT_URL),
  corsOrigins: Array.from(new Set(corsOrigins)),
  crossSiteCookies: Boolean(value.CROSS_SITE_COOKIES),
  trustProxy: String(value.TRUST_PROXY),
  mongoUri: String(value.MONGO_URI),
  redisUrl: String(value.REDIS_URL),
  jwtSecret: String(value.JWT_SECRET),
  jwtIssuer: String(value.JWT_ISSUER),
  jwtAudience: String(value.JWT_AUDIENCE),
  emailUser: String(value.EMAIL_USER),
  emailPass: String(value.EMAIL_PASS),
  emailFrom: String(value.EMAIL_FROM),
};

export const isProduction = env.nodeEnv === 'production';
