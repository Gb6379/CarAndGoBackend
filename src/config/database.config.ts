import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    // Check if DATABASE_URL is provided (Railway/Heroku style)
    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
      // Parse DATABASE_URL for Railway/Heroku deployment
      const url = new URL(databaseUrl);
      return {
        type: 'postgres',
        host: url.hostname,
        port: parseInt(url.port, 10),
        username: url.username,
        password: url.password,
        database: url.pathname.substring(1), // Remove leading slash
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        synchronize: process.env.NODE_ENV !== 'production',
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      };
    }

    // Fallback to individual environment variables (localhost development)
    return {
      type: 'postgres',
      host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
      port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
      username: process.env.DB_USERNAME || process.env.PGUSER || 'postgres',
      password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '12345678',
      database: process.env.DB_DATABASE || process.env.PGDATABASE || 'postgres',
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
  }
}
