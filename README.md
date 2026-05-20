Prerequisites:

- [Vercel CLI](https://vercel.com/docs/cli) installed globally

Environment variables:

- DATABASE_URL
- EMBEDDINGS_ENABLED (optional, set to "false" to disable embeddings)
- TRANSFORMERS_MODEL (optional, default Xenova/all-MiniLM-L6-v2)
- TRANSFORMERS_CACHE (optional, overrides transformers.js cache directory)
- INBOUND_WEBHOOK_SECRET (verifies /webhooks/inbound)
- OUTBOUND_WEBHOOK_SECRET (verifies /webhooks/outbound-status)

To develop locally:

```
npm install
vc dev
```

```
open http://localhost:3000
```

To build locally:

```
npm install
vc build
```

To deploy:

```
npm install
vc deploy
```
