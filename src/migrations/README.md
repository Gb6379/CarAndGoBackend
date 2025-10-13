# Database Migrations

This directory contains TypeORM database migrations for the CAR AND GO backend.

## Automatic Migrations

Migrations run automatically when the backend starts. The server will:
1. Check for pending migrations
2. Run them automatically
3. Start the application

## Manual Migration Commands

### Generate a new migration
```bash
npm run migration:generate -- src/migrations/YourMigrationName
```

### Run migrations manually
```bash
npm run migration:run
```

### Revert the last migration
```bash
npm run migration:revert
```

## Migration Files

- **1697234567890-InitialSchema.ts**: Initial database schema with all tables (user, vehicle, booking, locator_device, inspection)

## Important Notes

- Always review generated migrations before committing
- Never edit existing migrations that have been run in production
- Create new migrations for schema changes
- Test migrations in development before deploying to production

