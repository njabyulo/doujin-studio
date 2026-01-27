// Remotion Lambda function configuration
import { bucket } from './storage';

export const remotionFunction = new sst.aws.Function('RemotionFunction', {
  handler: 'packages/remotion/src/lambda.handler',
  timeout: '15 minutes',
  memory: '3 GB',
  link: [bucket],
  environment: {
    REMOTION_SERVE_URL: process.env.REMOTION_SERVE_URL!,
  },
});
