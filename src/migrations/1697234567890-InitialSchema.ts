import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1697234567890 implements MigrationInterface {
  name = 'InitialSchema1697234567890';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(`
      CREATE TYPE "users_usertype_enum" AS ENUM('CUSTOMER', 'OWNER', 'ADMIN');
    `);
    await queryRunner.query(`
      CREATE TYPE "users_status_enum" AS ENUM('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED');
    `);
    await queryRunner.query(`
      CREATE TYPE "vehicles_type_enum" AS ENUM('SEDAN', 'SUV', 'HATCHBACK', 'COUPE', 'CONVERTIBLE', 'PICKUP', 'VAN', 'MOTORCYCLE');
    `);
    await queryRunner.query(`
      CREATE TYPE "vehicles_fueltype_enum" AS ENUM('GASOLINE', 'ETHANOL', 'DIESEL', 'FLEX', 'ELECTRIC', 'HYBRID');
    `);
    await queryRunner.query(`
      CREATE TYPE "vehicles_status_enum" AS ENUM('PENDING', 'ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DELETED');
    `);
    await queryRunner.query(`
      CREATE TYPE "bookings_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'REJECTED');
    `);
    await queryRunner.query(`
      CREATE TYPE "bookings_paymentstatus_enum" AS ENUM('PENDING', 'PAID', 'REFUNDED', 'FAILED');
    `);
    await queryRunner.query(`
      CREATE TYPE "inspections_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED');
    `);
    await queryRunner.query(`
      CREATE TYPE "locator_devices_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE');
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password" character varying NOT NULL,
        "firstName" character varying NOT NULL,
        "lastName" character varying NOT NULL,
        "cpfCnpj" character varying NOT NULL,
        "userType" "users_usertype_enum" NOT NULL,
        "status" "users_status_enum" NOT NULL DEFAULT 'PENDING',
        "phone" character varying,
        "birthDate" date,
        "street" character varying,
        "number" character varying,
        "complement" character varying,
        "neighborhood" character varying,
        "city" character varying,
        "state" character varying,
        "zipCode" character varying,
        "documentsVerified" boolean NOT NULL DEFAULT false,
        "govBrId" character varying,
        "creditScore" integer,
        "criminalBackgroundCheck" boolean NOT NULL DEFAULT false,
        "profilePhoto" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_cpfCnpj" UNIQUE ("cpfCnpj"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create vehicles table
    await queryRunner.query(`
      CREATE TABLE "vehicles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "make" character varying NOT NULL,
        "model" character varying NOT NULL,
        "year" integer NOT NULL,
        "licensePlate" character varying NOT NULL,
        "type" "vehicles_type_enum" NOT NULL,
        "fuelType" "vehicles_fueltype_enum" NOT NULL,
        "engineCapacity" integer NOT NULL,
        "mileage" integer NOT NULL,
        "dailyRate" numeric(10,2) NOT NULL,
        "hourlyRate" numeric(10,2) NOT NULL,
        "securityDeposit" numeric(10,2),
        "status" "vehicles_status_enum" NOT NULL DEFAULT 'PENDING',
        "totalBookings" integer NOT NULL DEFAULT 0,
        "rating" numeric(5,2),
        "address" character varying NOT NULL,
        "city" character varying NOT NULL,
        "state" character varying NOT NULL,
        "latitude" numeric(10,8),
        "longitude" numeric(11,8),
        "color" character varying,
        "transmission" character varying,
        "seats" integer NOT NULL DEFAULT 0,
        "airConditioning" boolean NOT NULL DEFAULT false,
        "gps" boolean NOT NULL DEFAULT false,
        "bluetooth" boolean NOT NULL DEFAULT false,
        "usbCharger" boolean NOT NULL DEFAULT false,
        "locatorDeviceId" character varying,
        "locatorInstalled" boolean NOT NULL DEFAULT false,
        "locatorIntegrated" boolean NOT NULL DEFAULT false,
        "inspectionPassed" boolean NOT NULL DEFAULT false,
        "inspectionDate" TIMESTAMP,
        "inspectorId" character varying,
        "registrationDocument" character varying,
        "insuranceDocument" character varying,
        "inspectionDocument" character varying,
        "photos" text array DEFAULT '{}',
        "thumbnail" character varying,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "ownerId" uuid NOT NULL,
        CONSTRAINT "UQ_vehicles_licensePlate" UNIQUE ("licensePlate"),
        CONSTRAINT "PK_vehicles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_vehicles_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create bookings table
    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "status" "bookings_status_enum" NOT NULL DEFAULT 'PENDING',
        "startDate" TIMESTAMP NOT NULL,
        "endDate" TIMESTAMP NOT NULL,
        "actualStartDate" TIMESTAMP,
        "actualEndDate" TIMESTAMP,
        "dailyRate" numeric(10,2) NOT NULL,
        "hourlyRate" numeric(10,2) NOT NULL,
        "totalAmount" numeric(10,2) NOT NULL,
        "platformFee" numeric(10,2) NOT NULL,
        "lessorAmount" numeric(10,2) NOT NULL,
        "securityDeposit" numeric(10,2) NOT NULL,
        "additionalFees" numeric(10,2),
        "originCity" character varying,
        "destinationCity" character varying,
        "originLatitude" numeric(10,8),
        "originLongitude" numeric(11,8),
        "destinationLatitude" numeric(10,8),
        "destinationLongitude" numeric(11,8),
        "scheduledRoute" character varying,
        "plannedDistance" integer NOT NULL DEFAULT 0,
        "actualDistance" integer NOT NULL DEFAULT 0,
        "startMileage" integer NOT NULL DEFAULT 0,
        "endMileage" integer NOT NULL DEFAULT 0,
        "startPhotos" character varying,
        "endPhotos" character varying,
        "vehicleCondition" character varying,
        "paymentStatus" "bookings_paymentstatus_enum" NOT NULL DEFAULT 'PENDING',
        "paymentTransactionId" character varying,
        "paymentMethod" character varying,
        "paymentDate" TIMESTAMP,
        "refundDate" TIMESTAMP,
        "refundAmount" numeric(10,2),
        "videoChatId" character varying,
        "videoChatStartTime" TIMESTAMP,
        "videoChatEndTime" TIMESTAMP,
        "checkoutCompleted" boolean NOT NULL DEFAULT false,
        "checkoutTime" TIMESTAMP,
        "checkoutNotes" character varying,
        "returnCompleted" boolean NOT NULL DEFAULT false,
        "returnTime" TIMESTAMP,
        "returnNotes" character varying,
        "earlyReturn" boolean NOT NULL DEFAULT false,
        "earlyReturnDate" TIMESTAMP,
        "earlyReturnDiscount" numeric(10,2),
        "lesseeRating" integer,
        "lessorRating" integer,
        "lesseeReview" character varying,
        "lessorReview" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lesseeId" uuid NOT NULL,
        "lessorId" uuid NOT NULL,
        "vehicleId" uuid NOT NULL,
        CONSTRAINT "PK_bookings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_bookings_lessee" FOREIGN KEY ("lesseeId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_bookings_lessor" FOREIGN KEY ("lessorId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_bookings_vehicle" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE
      )
    `);

    // Create locator_devices table
    await queryRunner.query(`
      CREATE TABLE "locator_devices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "deviceId" character varying NOT NULL,
        "deviceName" character varying,
        "status" "locator_devices_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "lastPosition" character varying,
        "lastLatitude" numeric(10,8),
        "lastLongitude" numeric(11,8),
        "lastUpdate" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "vehicleId" uuid NOT NULL,
        CONSTRAINT "UQ_locator_devices_deviceId" UNIQUE ("deviceId"),
        CONSTRAINT "PK_locator_devices" PRIMARY KEY ("id"),
        CONSTRAINT "FK_locator_devices_vehicle" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE
      )
    `);

    // Create inspections table
    await queryRunner.query(`
      CREATE TABLE "inspections" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "inspectionDate" TIMESTAMP NOT NULL,
        "status" "inspections_status_enum" NOT NULL DEFAULT 'PENDING',
        "notes" text,
        "photos" text array DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "vehicleId" uuid NOT NULL,
        "bookingId" uuid,
        "inspectorId" uuid NOT NULL,
        CONSTRAINT "PK_inspections" PRIMARY KEY ("id"),
        CONSTRAINT "FK_inspections_vehicle" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inspections_booking" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_inspections_inspector" FOREIGN KEY ("inspectorId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await queryRunner.query(`CREATE INDEX "IDX_vehicles_ownerId" ON "vehicles" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX "IDX_vehicles_status" ON "vehicles" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_vehicles_isActive" ON "vehicles" ("isActive")`);
    await queryRunner.query(`CREATE INDEX "IDX_bookings_lesseeId" ON "bookings" ("lesseeId")`);
    await queryRunner.query(`CREATE INDEX "IDX_bookings_lessorId" ON "bookings" ("lessorId")`);
    await queryRunner.query(`CREATE INDEX "IDX_bookings_vehicleId" ON "bookings" ("vehicleId")`);
    await queryRunner.query(`CREATE INDEX "IDX_bookings_status" ON "bookings" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_locator_devices_vehicleId" ON "locator_devices" ("vehicleId")`);
    await queryRunner.query(`CREATE INDEX "IDX_inspections_vehicleId" ON "inspections" ("vehicleId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_inspections_vehicleId"`);
    await queryRunner.query(`DROP INDEX "IDX_locator_devices_vehicleId"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_status"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_vehicleId"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_lessorId"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_lesseeId"`);
    await queryRunner.query(`DROP INDEX "IDX_vehicles_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_vehicles_status"`);
    await queryRunner.query(`DROP INDEX "IDX_vehicles_ownerId"`);

    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "inspections"`);
    await queryRunner.query(`DROP TABLE "locator_devices"`);
    await queryRunner.query(`DROP TABLE "bookings"`);
    await queryRunner.query(`DROP TABLE "vehicles"`);
    await queryRunner.query(`DROP TABLE "users"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE "locator_devices_status_enum"`);
    await queryRunner.query(`DROP TYPE "inspections_status_enum"`);
    await queryRunner.query(`DROP TYPE "bookings_paymentstatus_enum"`);
    await queryRunner.query(`DROP TYPE "bookings_status_enum"`);
    await queryRunner.query(`DROP TYPE "vehicles_status_enum"`);
    await queryRunner.query(`DROP TYPE "vehicles_fueltype_enum"`);
    await queryRunner.query(`DROP TYPE "vehicles_type_enum"`);
    await queryRunner.query(`DROP TYPE "users_status_enum"`);
    await queryRunner.query(`DROP TYPE "users_usertype_enum"`);
  }
}

