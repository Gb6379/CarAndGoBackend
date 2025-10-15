-- Drop all tables and types to start fresh
DROP TABLE IF EXISTS "inspections" CASCADE;
DROP TABLE IF EXISTS "locator_devices" CASCADE;
DROP TABLE IF EXISTS "bookings" CASCADE;
DROP TABLE IF EXISTS "vehicles" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "migrations" CASCADE;

-- Drop all enum types
DROP TYPE IF EXISTS "locator_devices_status_enum" CASCADE;
DROP TYPE IF EXISTS "inspections_status_enum" CASCADE;
DROP TYPE IF EXISTS "bookings_paymentstatus_enum" CASCADE;
DROP TYPE IF EXISTS "bookings_status_enum" CASCADE;
DROP TYPE IF EXISTS "vehicles_status_enum" CASCADE;
DROP TYPE IF EXISTS "vehicles_fueltype_enum" CASCADE;
DROP TYPE IF EXISTS "vehicles_type_enum" CASCADE;
DROP TYPE IF EXISTS "users_status_enum" CASCADE;
DROP TYPE IF EXISTS "users_usertype_enum" CASCADE;

