/// <reference path="../.sst/platform/config.d.ts" />

// VPC for database and compute resources
export const vpc = new sst.aws.Vpc('MyVpc');
