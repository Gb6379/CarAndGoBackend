import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
  username: process.env.DB_USERNAME || process.env.PGUSER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '12345678',
  database: process.env.DB_DATABASE || process.env.PGDATABASE || 'postgres',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  logging: true,
});
