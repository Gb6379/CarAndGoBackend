import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixVehicleStatusEnumCase1728883200000 implements MigrationInterface {
  name = 'FixVehicleStatusEnumCase1728883200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old enum type
    await queryRunner.query(`DROP TYPE IF EXISTS "vehicles_status_enum" CASCADE`);
    
    // Create the new enum with lowercase values
    await queryRunner.query(`
      CREATE TYPE "vehicles_status_enum" AS ENUM('pending', 'active', 'inactive', 'inspection_failed', 'maintenance', 'rented')
    `);
    
    // Check if status column exists and add it if it doesn't
    const table = await queryRunner.getTable('vehicles');
    const hasStatusColumn = table?.findColumnByName('status');
    
    if (!hasStatusColumn) {
      // Add the status column
      await queryRunner.query(`
        ALTER TABLE "vehicles" 
        ADD COLUMN "status" "vehicles_status_enum" NOT NULL DEFAULT 'pending'
      `);
    } else {
      // Alter the existing column to use the new enum
      await queryRunner.query(`
        ALTER TABLE "vehicles" 
        ALTER COLUMN "status" TYPE "vehicles_status_enum" 
        USING "status"::text::"vehicles_status_enum"
      `);
      
      // Set default value
      await queryRunner.query(`
        ALTER TABLE "vehicles" 
        ALTER COLUMN "status" SET DEFAULT 'pending'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the lowercase enum
    await queryRunner.query(`DROP TYPE IF EXISTS "vehicles_status_enum" CASCADE`);
    
    // Recreate with uppercase values
    await queryRunner.query(`
      CREATE TYPE "vehicles_status_enum" AS ENUM('PENDING', 'ACTIVE', 'INACTIVE', 'MAINTENANCE', 'DELETED')
    `);
    
    // Alter the vehicles table back
    await queryRunner.query(`
      ALTER TABLE "vehicles" 
      ALTER COLUMN "status" TYPE "vehicles_status_enum" 
      USING "status"::text::"vehicles_status_enum"
    `);
    
    // Set default value
    await queryRunner.query(`
      ALTER TABLE "vehicles" 
      ALTER COLUMN "status" SET DEFAULT 'PENDING'
    `);
  }
}

