import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProfilePhotoInDb1738540800000 implements MigrationInterface {
  name = 'ProfilePhotoInDb1738540800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "profilePhotoData" bytea,
      ADD COLUMN "profilePhotoMimeType" character varying(30)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN "profilePhotoData",
      DROP COLUMN "profilePhotoMimeType"
    `);
  }
}
