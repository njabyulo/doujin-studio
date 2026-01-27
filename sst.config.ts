/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "a-ds",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    const infra = await import('./infra');

    return {
      bucket: infra.bucket.name,
      database: infra.database.host,
    };
  },
});
