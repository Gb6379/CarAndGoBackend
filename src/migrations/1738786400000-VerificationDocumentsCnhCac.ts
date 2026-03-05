import { MigrationInterface, QueryRunner } from 'typeorm';

export class VerificationDocumentsCnhCac1738786400000 implements MigrationInterface {
  name = 'VerificationDocumentsCnhCac1738786400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "cnhDocumentData" bytea,
      ADD COLUMN "cnhDocumentMimeType" character varying(100),
      ADD COLUMN "cacDocumentData" bytea,
      ADD COLUMN "cacDocumentMimeType" character varying(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "cnhDocumentData",
      DROP COLUMN "cnhDocumentMimeType",
      DROP COLUMN "cacDocumentData",
      DROP COLUMN "cacDocumentMimeType"
    `);
  }
}
