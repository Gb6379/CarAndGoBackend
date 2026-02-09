import { MigrationInterface, QueryRunner } from 'typeorm';

export class FuelTypeCombustaoEletrico1738700000000 implements MigrationInterface {
  name = 'FuelTypeCombustaoEletrico1738700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar novo tipo com apenas combustao e eletrico
    await queryRunner.query(`
      CREATE TYPE "vehicles_fueltype_new" AS ENUM ('combustao', 'eletrico')
    `);
    // Coluna temporária com o novo tipo
    await queryRunner.query(`
      ALTER TABLE "vehicles" ADD COLUMN "fuelTypeNew" "vehicles_fueltype_new"
    `);
    // Mapear: electric -> eletrico, demais -> combustao
    await queryRunner.query(`
      UPDATE "vehicles" SET "fuelTypeNew" = 'eletrico'::"vehicles_fueltype_new"
      WHERE "fuelType"::text = 'electric'
    `);
    await queryRunner.query(`
      UPDATE "vehicles" SET "fuelTypeNew" = 'combustao'::"vehicles_fueltype_new"
      WHERE "fuelTypeNew" IS NULL
    `);
    // Remover coluna antiga e tipo antigo
    await queryRunner.query(`ALTER TABLE "vehicles" DROP COLUMN "fuelType"`);
    await queryRunner.query(`DROP TYPE "vehicles_fueltype_enum"`);
    // Renomear novo tipo e coluna
    await queryRunner.query(`
      ALTER TYPE "vehicles_fueltype_new" RENAME TO "vehicles_fueltype_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "vehicles" RENAME COLUMN "fuelTypeNew" TO "fuelType"
    `);
    await queryRunner.query(`
      ALTER TABLE "vehicles" ALTER COLUMN "fuelType" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "vehicles_fueltype_old" AS ENUM ('gasoline', 'ethanol', 'diesel', 'flex', 'electric', 'hybrid')
    `);
    await queryRunner.query(`
      ALTER TABLE "vehicles" ADD COLUMN "fuelTypeOld" "vehicles_fueltype_old"
    `);
    await queryRunner.query(`
      UPDATE "vehicles" SET "fuelTypeOld" = 'electric'::"vehicles_fueltype_old" WHERE "fuelType"::text = 'eletrico'
    `);
    await queryRunner.query(`
      UPDATE "vehicles" SET "fuelTypeOld" = 'flex'::"vehicles_fueltype_old" WHERE "fuelTypeOld" IS NULL
    `);
    await queryRunner.query(`ALTER TABLE "vehicles" DROP COLUMN "fuelType"`);
    await queryRunner.query(`DROP TYPE "vehicles_fueltype_enum"`);
    await queryRunner.query(`
      ALTER TYPE "vehicles_fueltype_old" RENAME TO "vehicles_fueltype_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "vehicles" RENAME COLUMN "fuelTypeOld" TO "fuelType"
    `);
    await queryRunner.query(`
      ALTER TABLE "vehicles" ALTER COLUMN "fuelType" SET NOT NULL
    `);
  }
}
