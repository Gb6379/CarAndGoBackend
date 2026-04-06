import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import express from 'express';

config();

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  
  let dbConfig: any;
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    // Parse DATABASE_URL for Railway/Heroku deployment
    const url = new URL(databaseUrl);
    dbConfig = {
      type: 'postgres',
      host: url.hostname,
      port: parseInt(url.port, 10),
      username: url.username,
      password: url.password,
      database: url.pathname.substring(1), // Remove leading slash
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  } else {
    // Fallback to individual environment variables
    dbConfig = {
      type: 'postgres',
      host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
      port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
      username: process.env.DB_USERNAME || process.env.PGUSER || 'postgres',
      password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '12345678',
      database: process.env.DB_DATABASE || process.env.PGDATABASE || 'postgres',
    };
  }

  const dataSource = new DataSource({
    ...dbConfig,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    await dataSource.runMigrations();
    console.log('✅ Migrations completed successfully');
    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    await dataSource.destroy();
    throw error;
  }
}

async function runSeeding() {
  console.log('🌱 Running database seeding...');
  
  let dbConfig: any;
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    // Parse DATABASE_URL for Railway/Heroku deployment
    const url = new URL(databaseUrl);
    dbConfig = {
      type: 'postgres',
      host: url.hostname,
      port: parseInt(url.port, 10),
      username: url.username,
      password: url.password,
      database: url.pathname.substring(1), // Remove leading slash
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  } else {
    // Fallback to individual environment variables
    dbConfig = {
      type: 'postgres',
      host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
      port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
      username: process.env.DB_USERNAME || process.env.PGUSER || 'postgres',
      password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '12345678',
      database: process.env.DB_DATABASE || process.env.PGDATABASE || 'postgres',
    };
  }

  const dataSource = new DataSource({
    ...dbConfig,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    
    // Check if we already have data
    const userCount = await dataSource.query('SELECT COUNT(*) as count FROM users');
    const vehicleCount = await dataSource.query('SELECT COUNT(*) as count FROM vehicles');
    
    if (userCount[0].count > 0 || vehicleCount[0].count > 0) {
      console.log('📊 Database already has data, skipping full seeding');
      console.log(`   Users: ${userCount[0].count}, Vehicles: ${vehicleCount[0].count}`);
      // Garante que o admin existe mesmo com banco já populado (ex.: produção)
      const { ensureAdminUser } = await import('./seed');
      await ensureAdminUser(dataSource);
      console.log('✅ Admin user ensured');
    } else {
      console.log('🌱 No data found, running full seeding...');
      const { seedDatabase } = await import('./seed');
      await seedDatabase(dataSource);
      console.log('✅ Seeding completed successfully');
    }
    
    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error('Full error:', error);
    await dataSource.destroy();
    throw error;
  }
}

async function bootstrap() {
  try {
    // Run migrations before starting the app
    await runMigrations();
    
    // Run seeding after migrations (only in production or when explicitly requested)
    if (process.env.NODE_ENV === 'production' || process.env.RUN_SEED === 'true') {
      await runSeeding();
    }

    const app = await NestFactory.create(AppModule, { bodyParser: false });

    // Aumentar limite do body para permitir upload de fotos (base64) no anúncio do veículo
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // Global exception filter for better error logging
    app.useGlobalFilters(new AllExceptionsFilter());
    
  // Enable CORS (wildcard strings like *.railway.app are NOT supported by the browser/cors package)
  const corsOrigins = new Set([
    'http://localhost:3001',
    'http://localhost:3000',
    'http://localhost:19006',
    'https://carandgoapp-production.up.railway.app',
    'https://www.carandgo.com.br',
    'https://carandgo.com.br',
  ]);
  const railwayPreview = /^https:\/\/[a-zA-Z0-9-]+\.up\.railway\.app$/;
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (corsOrigins.has(origin) || railwayPreview.test(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  });

    // Global validation pipe
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        console.error('Validation errors:', errors);
        return new Error('Validation failed');
      },
    }));

    const port = process.env.PORT || 3000;
    await app.listen(port);
    
    console.log('=====================================');
    console.log('🚗 CAR AND GO Backend API');
    console.log(`📍 Running on port: ${port}`);
    console.log(`🌐 API URL: http://localhost:${port}`);
    console.log('=====================================');
  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

bootstrap();
