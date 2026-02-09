import { MigrationInterface, QueryRunner } from 'typeorm';

export class LessorBankDetails1738627200000 implements MigrationInterface {
  name = 'LessorBankDetails1738627200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "bankName" character varying,
      ADD COLUMN "bankAgency" character varying,
      ADD COLUMN "bankAccount" character varying,
      ADD COLUMN "bankAccountType" character varying,
      ADD COLUMN "bankHolderName" character varying,
      ADD COLUMN "bankHolderDocument" character varying,
      ADD COLUMN "pixKey" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "bankName",
      DROP COLUMN "bankAgency",
      DROP COLUMN "bankAccount",
      DROP COLUMN "bankAccountType",
      DROP COLUMN "bankHolderName",
      DROP COLUMN "bankHolderDocument",
      DROP COLUMN "pixKey"
    `);
  }
}
