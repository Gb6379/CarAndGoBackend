import { MigrationInterface, QueryRunner } from 'typeorm';

export class VehicleAutoApproveAndPickupWindow1749300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "vehicles"
      ADD COLUMN "autoApproveBookings" boolean NOT NULL DEFAULT false,
      ADD COLUMN "pickupTimeStart" character varying(5),
      ADD COLUMN "pickupTimeEnd" character varying(5)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "vehicles"
      DROP COLUMN "pickupTimeEnd",
      DROP COLUMN "pickupTimeStart",
      DROP COLUMN "autoApproveBookings"
    `);
  }
}
