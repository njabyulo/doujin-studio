// S3 bucket configuration for video storage
export const bucket = new sst.aws.Bucket('VideoBucket', {
  access: 'public',
});

export const bucketName = bucket.name;
