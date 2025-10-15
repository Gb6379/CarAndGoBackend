import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
  port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
  username: process.env.DB_USERNAME || process.env.PGUSER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '12345678',
  database: process.env.DB_DATABASE || process.env.PGDATABASE || 'postgres',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: false,
});

async function clearMigrations() {
  await dataSource.initialize();
  
  // Drop all tables and types
  await dataSource.query(`DROP TABLE IF EXISTS "bookings" CASCADE`);
  await dataSource.query(`DROP TABLE IF EXISTS "inspections" CASCADE`);
  await dataSource.query(`DROP TABLE IF EXISTS "locator_devices" CASCADE`);
  await dataSource.query(`DROP TABLE IF EXISTS "vehicles" CASCADE`);
  await dataSource.query(`DROP TABLE IF EXISTS "users" CASCADE`);
  await dataSource.query(`DROP TABLE IF EXISTS "migrations" CASCADE`);
  
  // Drop all enum types
  await dataSource.query(`DROP TYPE IF EXISTS "bookings_status_enum" CASCADE`);
  await dataSource.query(`DROP TYPE IF EXISTS "bookings_paymentstatus_enum" CASCADE`);
  await dataSource.query(`DROP TYPE IF EXISTS "inspections_status_enum" CASCADE`);
  await dataSource.query(`DROP TYPE IF EXISTS "locator_devices_status_enum" CASCADE`);
  await dataSource.query(`DROP TYPE IF EXISTS "vehicles_status_enum" CASCADE`);
  await dataSource.query(`DROP TYPE IF EXISTS "vehicles_type_enum" CASCADE`);
  await dataSource.query(`DROP TYPE IF EXISTS "vehicles_fueltype_enum" CASCADE`);
  await dataSource.query(`DROP TYPE IF EXISTS "users_status_enum" CASCADE`);
  await dataSource.query(`DROP TYPE IF EXISTS "users_usertype_enum" CASCADE`);
  
  console.log('✅ Database cleared successfully!');
  await dataSource.destroy();
}

clearMigrations().catch(error => {
  console.error('❌ Error clearing database:', error);
  process.exit(1);
});

