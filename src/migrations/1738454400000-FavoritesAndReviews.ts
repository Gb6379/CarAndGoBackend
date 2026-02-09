import { MigrationInterface, QueryRunner } from 'typeorm';

export class FavoritesAndReviews1738454400000 implements MigrationInterface {
  name = 'FavoritesAndReviews1738454400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "favorites" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "vehicleId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_favorites" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_favorites_user_vehicle" UNIQUE ("userId", "vehicleId"),
        CONSTRAINT "FK_favorites_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_favorites_vehicle" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "vehicleId" uuid NOT NULL,
        "rating" smallint NOT NULL,
        "comment" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reviews" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_reviews_user_vehicle" UNIQUE ("userId", "vehicleId"),
        CONSTRAINT "FK_reviews_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_reviews_vehicle" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_reviews_rating" CHECK ("rating" >= 1 AND "rating" <= 5)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "reviews"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "favorites"`);
  }
}
