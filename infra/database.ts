/// <reference path="../.sst/platform/config.d.ts" />

import { vpc } from './vpc';

// PostgreSQL database with RDS
// In dev mode, connects to local Docker Postgres
// In production, deploys RDS instance in VPC
export const database = new sst.aws.Postgres('Database', {
  vpc,
  version: '16.4',
  instance: 't4g.micro',
  storage: '20 GB',
  dev: {
    username: 'postgres',
    password: 'password',
    database: 'local',
    host: 'localhost',
    port: 5432,
  },
});
