/// <reference path="../.sst/platform/config.d.ts" />

import { databaseConfig } from "./config";
import { vpc } from "./vpc";

export const database = new sst.aws.Postgres("Database", {
  vpc,
  version: "16.4",
  instance: "t4g.micro",
  storage: "20 GB",
  dev: databaseConfig.postgres.dev,
});
