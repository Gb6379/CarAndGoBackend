# Database Seeding

## Automatic Seeding

The database will be automatically seeded when:

1. **Production Environment**: `NODE_ENV=production` 
2. **Manual Trigger**: `RUN_SEED=true`

## How It Works

1. **Migrations run first** (always)
2. **Seeding runs after migrations** (if conditions are met)
3. **Smart seeding**: Only seeds if database is empty
4. **Safe**: Won't overwrite existing data

## Environment Variables

```bash
# Automatic seeding in production
NODE_ENV=production

# Manual seeding trigger
RUN_SEED=true

# Database connection
DATABASE_URL=postgresql://...
# OR individual variables
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_DATABASE=cargo
```

## Commands

```bash
# Manual seeding (standalone)
npm run seed

# Force seeding (ignores existing data)
npm run seed:force

# Start production with seeding
npm run start:with-seed
```

## What Gets Seeded

- **2 Test Users**:
  - Lessor: `owner@test.com` / `password123`
  - Lessee: `customer@test.com` / `password123`

- **5 Test Vehicles** in São Paulo:
  - Toyota Corolla 2022 - R$150/day
  - Honda Civic 2023 - R$180/day
  - Volkswagen Gol 2021 - R$120/day
  - Chevrolet Onix 2022 - R$130/day
  - Fiat Uno 2020 - R$100/day

## Production Deployment

When you deploy to production (Railway/Heroku), the seeding will happen automatically because `NODE_ENV=production` is set by the platform.

## Console Output

```
🔄 Running database migrations...
✅ Migrations completed successfully
🌱 Running database seeding...
📊 Database already has data, skipping seeding
   Users: 2, Vehicles: 5
```

OR

```
🔄 Running database migrations...
✅ Migrations completed successfully
🌱 Running database seeding...
🌱 No data found, running seeding...
✅ Test users created/found
✅ Test vehicles created successfully!
📊 Total vehicles in database: 5
✅ Seeding completed successfully
```
