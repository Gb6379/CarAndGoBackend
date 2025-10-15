import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

async function resetMigrations() {
  console.log('🔄 Resetting migrations...');

  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '12345678',
    database: process.env.DB_DATABASE || 'postgres',
  });

  try {
    await ds.initialize();
    
    // Drop and recreate migrations table
    await ds.query(`DROP TABLE IF EXISTS "migrations" CASCADE`);
    await ds.query(`CREATE TABLE "migrations" ("id" SERIAL NOT NULL, "timestamp" bigint NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY ("id"))`);
    
    console.log('✅ Migrations table reset');
    await ds.destroy();
  } catch (error) {
    console.error('❌ Error:', error);
    await ds.destroy();
    process.exit(1);
  }
}

resetMigrations();

