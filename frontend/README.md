# Chart Hunter Frontend

## Privy + Tempo setup

1. Copy envs:

```bash
cp .env.example .env.local
```

2. Set at minimum:

- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_PRIVY_CLIENT_ID`

3. For backend token verification (`/api/auth/privy/verify`), also set:

- `PRIVY_APP_ID`
- `PRIVY_APP_SECRET`

4. Optional user persistence in Postgres:

- `DATABASE_URL`

If `DATABASE_URL` is not set, auth verification still works but user records are not persisted.
