/// <reference path="../.sst/platform/config.d.ts" />

// S3 bucket for video storage with public access
export const bucket = new sst.aws.Bucket('VideoBucket', {
  access: 'public',
});

export const bucketName = bucket.name;
