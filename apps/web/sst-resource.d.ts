declare module "sst" {
  export interface Resource {
    VideoBucket: {
      name: string;
    };
  }

  export const Resource: Resource;
}
