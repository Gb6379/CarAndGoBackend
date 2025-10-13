# Railway Deployment Configuration

## Environment Variables for Railway

### Database Configuration

For Railway deployment, you need to set the `DATABASE_URL` environment variable in your Railway dashboard:

```
DATABASE_URL=postgresql://username:password@hostname:port/database_name
```

Example:
```
DATABASE_URL=postgresql://postgres:abc123@containers-us-west-123.railway.app:6543/railway
```

### Database Synchronization (Auto-Create Tables)

**For FIRST deployment only**, set this to automatically create tables:

```
DB_SYNCHRONIZE=true
```

⚠️ **IMPORTANT**: After the first successful deployment, set this to `false` or remove it to prevent accidental data loss:

```
DB_SYNCHRONIZE=false
```

### Other Required Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Application Configuration
PORT=3000
NODE_ENV=production

# PagSeguro Configuration (if using)
PAGSEGURO_EMAIL=your-pagseguro-email
PAGSEGURO_TOKEN=your-pagseguro-token
PAGSEGURO_SANDBOX=false

# GOV.BR Configuration (if using)
GOV_BR_CLIENT_ID=your-gov-br-client-id
GOV_BR_CLIENT_SECRET=your-gov-br-client-secret
GOV_BR_REDIRECT_URI=https://your-app.railway.app/auth/gov-br/callback
```

## Local Development Configuration

For local development, use the `config.env` file with individual database variables:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=12345678
DB_DATABASE=postgres
DB_SCHEMA=cargo
```

## How It Works

The database configuration automatically detects:

1. **Railway/Production**: If `DATABASE_URL` is present, it parses the URL to extract connection details
2. **Local Development**: If `DATABASE_URL` is not present, it uses individual environment variables

## Setting Environment Variables in Railway

1. Go to your Railway project dashboard
2. Navigate to the "Variables" tab
3. Add the `DATABASE_URL` variable with your PostgreSQL connection string
4. Add other required environment variables
5. Redeploy your application

## Database Connection Priority

1. `DATABASE_URL` (Railway/Heroku format)
2. Individual `DB_*` variables (localhost development)
3. Default fallback values (localhost defaults)
