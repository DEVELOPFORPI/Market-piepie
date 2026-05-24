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

## Run

```bash
npm run dev
```

- API health check: `http://localhost:3001/api/health`
- If no MySQL connection is configured, the server still starts and returns `db: "skipped"`.
