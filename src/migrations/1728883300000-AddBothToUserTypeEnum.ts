import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBothToUserTypeEnum1728883300000 implements MigrationInterface {
  name = 'AddBothToUserTypeEnum1728883300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'BOTH' to the existing enum
    await queryRunner.query(`
      ALTER TYPE "users_usertype_enum" ADD VALUE IF NOT EXISTS 'BOTH'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // This would require recreating the enum type
    // For now, we'll leave it as-is
  }
}

