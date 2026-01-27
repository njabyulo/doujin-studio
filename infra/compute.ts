/// <reference path="../.sst/platform/config.d.ts" />

import { computeConfig } from './config';
import { bucket } from './storage';

export const remotionFunction = new sst.aws.Function('RemotionFunction', {
  handler: 'apps/functions/src/handlers/http/remotion.handler',
  timeout: '15 minutes',
  memory: '3008 MB',
  link: [bucket],
  environment: {
    REMOTION_SERVE_URL: computeConfig.functions.remotion.serveURL,
  },
});

export const web = new sst.aws.Nextjs("WebApp", {
  // vpc: vpc!,
  path: "apps/web",
  // domain: config.network.domain.web,
  // link: [apiGateway],
  environment: {
    // NEXT_PUBLIC_API_URL: apiGateway.url,
    // API_URL: apiGateway.url,

    GOOGLE_GENERATIVE_AI_API_KEY: computeConfig.web.google.generative.apiKey
  },
});
