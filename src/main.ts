import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

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

async function bootstrap() {
  try {
    // Run migrations before starting the app
    await runMigrations();

    const app = await NestFactory.create(AppModule);
    
    // Enable CORS for frontend applications
    app.enableCors({
      origin: [
        'http://localhost:3001', 
        'http://localhost:3000', 
        'http://localhost:19006',
        'https://carandgoapp-production.up.railway.app',
        'https://*.up.railway.app' // Allow all Railway subdomains
      ],
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
