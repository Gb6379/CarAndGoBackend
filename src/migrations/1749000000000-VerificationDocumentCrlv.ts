import { MigrationInterface, QueryRunner } from 'typeorm';

export class VerificationDocumentCrlv1749000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "crlvDocumentData" bytea,
      ADD COLUMN "crlvDocumentMimeType" character varying(100),
      ADD COLUMN "crlvExtractedData" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "crlvExtractedData",
      DROP COLUMN "crlvDocumentMimeType",
      DROP COLUMN "crlvDocumentData"
    `);
  }
}
