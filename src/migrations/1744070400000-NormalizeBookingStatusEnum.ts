import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeBookingStatusEnum1744070400000 implements MigrationInterface {
  name = 'NormalizeBookingStatusEnum1744070400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "bookings_status_enum" RENAME TO "bookings_status_enum_old"`,
    );

    await queryRunner.query(`
      CREATE TYPE "bookings_status_enum" AS ENUM(
        'pending',
        'confirmed',
        'active',
        'awaiting_return',
        'completed',
        'cancelled',
        'rejected',
        'expired'
      )
    `);

    await queryRunner.query(`ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT`);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status" TYPE "bookings_status_enum"
      USING (
        CASE LOWER(CAST("status" AS TEXT))
          WHEN 'pending' THEN 'pending'
          WHEN 'confirmed' THEN 'confirmed'
          WHEN 'active' THEN 'active'
          WHEN 'awaiting_return' THEN 'awaiting_return'
          WHEN 'completed' THEN 'completed'
          WHEN 'cancelled' THEN 'cancelled'
          WHEN 'rejected' THEN 'rejected'
          WHEN 'expired' THEN 'expired'
          ELSE 'pending'
        END
      )::"bookings_status_enum"
    `);

    await queryRunner.query(`ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'pending'`);
    await queryRunner.query(`DROP TYPE "bookings_status_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "bookings_status_enum" RENAME TO "bookings_status_enum_new"`,
    );

    await queryRunner.query(`
      CREATE TYPE "bookings_status_enum" AS ENUM(
        'PENDING',
        'CONFIRMED',
        'ACTIVE',
        'COMPLETED',
        'CANCELLED',
        'REJECTED'
      )
    `);

    await queryRunner.query(`ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT`);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status" TYPE "bookings_status_enum"
      USING (
        CASE LOWER(CAST("status" AS TEXT))
          WHEN 'pending' THEN 'PENDING'
          WHEN 'confirmed' THEN 'CONFIRMED'
          WHEN 'active' THEN 'ACTIVE'
          WHEN 'awaiting_return' THEN 'ACTIVE'
          WHEN 'completed' THEN 'COMPLETED'
          WHEN 'cancelled' THEN 'CANCELLED'
          WHEN 'rejected' THEN 'REJECTED'
          WHEN 'expired' THEN 'CANCELLED'
          ELSE 'PENDING'
        END
      )::"bookings_status_enum"
    `);

    await queryRunner.query(`ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
    await queryRunner.query(`DROP TYPE "bookings_status_enum_new"`);
  }
}
