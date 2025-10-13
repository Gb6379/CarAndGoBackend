import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1697234567890 implements MigrationInterface {
  name = 'InitialSchema1697234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // User table
    await queryRunner.query(`
      CREATE TABLE "user" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "fullName" character varying NOT NULL,
        "phone" character varying,
        "document" character varying,
        "userType" character varying NOT NULL DEFAULT 'customer',
        "status" character varying NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_email" UNIQUE ("email"),
        CONSTRAINT "PK_user" PRIMARY KEY ("id")
      )
    `);

    // Vehicle table
    await queryRunner.query(`
      CREATE TABLE "vehicle" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ownerId" uuid NOT NULL,
        "brand" character varying NOT NULL,
        "model" character varying NOT NULL,
        "year" integer NOT NULL,
        "licensePlate" character varying NOT NULL,
        "color" character varying,
        "fuelType" character varying NOT NULL DEFAULT 'gasoline',
        "vehicleType" character varying NOT NULL DEFAULT 'sedan',
        "seats" integer NOT NULL DEFAULT 5,
        "dailyRate" numeric(10,2) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'available',
        "location" character varying,
        "latitude" double precision,
        "longitude" double precision,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_vehicle_licensePlate" UNIQUE ("licensePlate"),
        CONSTRAINT "PK_vehicle" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vehicle_owner" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    // Booking table
    await queryRunner.query(`
      CREATE TABLE "booking" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "vehicleId" uuid NOT NULL,
        "startDate" TIMESTAMP NOT NULL,
        "endDate" TIMESTAMP NOT NULL,
        "pickupLocation" character varying NOT NULL,
        "dropoffLocation" character varying,
        "pickupLatitude" double precision,
        "pickupLongitude" double precision,
        "dropoffLatitude" double precision,
        "dropoffLongitude" double precision,
        "totalDays" integer NOT NULL,
        "dailyRate" numeric(10,2) NOT NULL,
        "totalAmount" numeric(10,2) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "paymentStatus" character varying NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_booking" PRIMARY KEY ("id"),
        CONSTRAINT "FK_booking_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_booking_vehicle" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE
      )
    `);

    // Locator Device table
    await queryRunner.query(`
      CREATE TABLE "locator_device" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vehicleId" uuid NOT NULL,
        "deviceId" character varying NOT NULL,
        "deviceName" character varying,
        "status" character varying NOT NULL DEFAULT 'active',
        "lastPosition" character varying,
        "lastLatitude" double precision,
        "lastLongitude" double precision,
        "lastUpdate" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_locator_deviceId" UNIQUE ("deviceId"),
        CONSTRAINT "PK_locator_device" PRIMARY KEY ("id"),
        CONSTRAINT "FK_locator_device_vehicle" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE
      )
    `);

    // Inspection table
    await queryRunner.query(`
      CREATE TABLE "inspection" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vehicleId" uuid NOT NULL,
        "bookingId" uuid,
        "inspectorId" uuid NOT NULL,
        "inspectionDate" TIMESTAMP NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "notes" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inspection" PRIMARY KEY ("id"),
        CONSTRAINT "FK_inspection_vehicle" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inspection_booking" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_inspection_inspector" FOREIGN KEY ("inspectorId") REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await queryRunner.query(`CREATE INDEX "IDX_vehicle_ownerId" ON "vehicle" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX "IDX_vehicle_status" ON "vehicle" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_booking_userId" ON "booking" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_booking_vehicleId" ON "booking" ("vehicleId")`);
    await queryRunner.query(`CREATE INDEX "IDX_booking_status" ON "booking" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_locator_device_vehicleId" ON "locator_device" ("vehicleId")`);
    await queryRunner.query(`CREATE INDEX "IDX_inspection_vehicleId" ON "inspection" ("vehicleId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_inspection_vehicleId"`);
    await queryRunner.query(`DROP INDEX "IDX_locator_device_vehicleId"`);
    await queryRunner.query(`DROP INDEX "IDX_booking_status"`);
    await queryRunner.query(`DROP INDEX "IDX_booking_vehicleId"`);
    await queryRunner.query(`DROP INDEX "IDX_booking_userId"`);
    await queryRunner.query(`DROP INDEX "IDX_vehicle_status"`);
    await queryRunner.query(`DROP INDEX "IDX_vehicle_ownerId"`);

    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "inspection"`);
    await queryRunner.query(`DROP TABLE "locator_device"`);
    await queryRunner.query(`DROP TABLE "booking"`);
    await queryRunner.query(`DROP TABLE "vehicle"`);
    await queryRunner.query(`DROP TABLE "user"`);
  }
}

