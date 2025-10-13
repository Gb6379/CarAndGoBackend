import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

async function runMigrations() {
  console.log('🔄 Running database migrations...');
  
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
    port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
    username: process.env.DB_USERNAME || process.env.PGUSER || 'postgres',
    password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '12345678',
    database: process.env.DB_DATABASE || process.env.PGDATABASE || 'postgres',
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
    await dataSource.destroy();
    throw error;
  }
}

async function bootstrap() {
  // Run migrations before starting the app
  await runMigrations();

  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend applications
  app.enableCors({
    origin: ['http://localhost:3001', 'http://localhost:3000', 'http://localhost:19006'], // React web app and React Native
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
}

bootstrap();
