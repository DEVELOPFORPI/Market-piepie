# MarketPiePie Backend

## Requirements

- Node.js 18+
- MySQL 8.0.13+

## Install

```bash
cd backend
npm install
```

## Create the database

Run `mysql-schema.sql` with a MySQL user that can create databases:

```bash
mysql -u USER -p < mysql-schema.sql
```

The schema creates and uses the `marketpiepie` database.

## Configure

Copy `.env.example` to `.env` and set your MySQL credentials:

```env
DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/marketpiepie
```

You can also use `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` instead of `DATABASE_URL`.

## Configure Cloudflare R2 uploads

Image uploads go through `POST /api/uploads/image`, then the app stores the returned public URL instead of base64.

```env
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET=marketpiepie-images
R2_PUBLIC_URL=https://images.example.com
```

`R2_PUBLIC_URL` is optional. If it is blank, the backend returns `/api/uploads/object/...` URLs and streams images from R2. If you set it, use a public bucket URL or custom domain with no trailing slash. Optional values: `R2_ENDPOINT`, `R2_REGION`, `R2_UPLOAD_PREFIX`, `R2_MAX_UPLOAD_MB`.

## Run

```bash
npm run dev
```

- API health check: `http://localhost:3001/api/health`
- If no MySQL connection is configured, the server still starts and returns `db: "skipped"`.
