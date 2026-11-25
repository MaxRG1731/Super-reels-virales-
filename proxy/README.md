# Proxy de REEL FACTORY

Worker de Cloudflare que guarda tu clave de IA como secreto. Instrucciones completas en el [README principal](../README.md#conectar-ia-de-forma-segura).

```bash
cd proxy
wrangler secret put UPSTREAM_API_KEY
wrangler secret put ACCESS_TOKEN
wrangler deploy
```

Variables (en `wrangler.toml`): `UPSTREAM_BASE_URL`, `ALLOWED_ORIGINS`.
Secretos (con `wrangler secret put`): `UPSTREAM_API_KEY`, `ACCESS_TOKEN`.

Nunca pongas las claves en `wrangler.toml` ni en el repositorio.
