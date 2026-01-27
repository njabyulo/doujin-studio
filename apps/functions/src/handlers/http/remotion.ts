import { renderMediaOnLambda } from '@remotion/lambda/client';
import type { APIGatewayProxyHandler } from 'aws-lambda';
import { Resource } from 'sst';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const { composition, inputProps, codec = 'h264' } = body;

    if (!composition || !inputProps) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields: composition, inputProps',
        }),
      };
    }

    const { renderId, bucketName } = await renderMediaOnLambda({
      region: (process.env.AWS_REGION || 'us-east-1') as 'us-east-1',
      functionName: Resource.RemotionFunction.name,
      composition,
      serveUrl: process.env.REMOTION_SERVE_URL!,
      codec,
      inputProps,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ renderId, bucketName }),
    };
  } catch (error) {
    console.error('Remotion render error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
    };
  }
};
