# solana-parser

Solana block parser pipeline (block-listener → parser → token-enricher / clickhouse-writer) that
streams parsed on-chain events through Kafka into ClickHouse, with a GraphQL read API on top.
NestJS microservices monorepo.

## Prerequisites

- Node.js 22+
- Docker (with Compose v2)

## Getting started

```bash
cp .env.example .env
docker compose up -d
npm install
npm run migrate
```

`docker compose up -d` starts ClickHouse (`localhost:8123`) and Kafka (`localhost:9092`).
`npm run migrate` applies the ClickHouse schema in `sql/schema/`.

## Running an app in dev

```bash
npx nest start <app-name> --watch
```

where `<app-name>` is one of: `block-listener`, `parser`, `token-enricher`, `clickhouse-writer`, `api`.

## Tests & lint

```bash
npm test
npm run lint
```
