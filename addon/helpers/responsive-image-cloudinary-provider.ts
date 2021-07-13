import { inject as service } from '@ember/service';
import Helper from '@ember/component/helper';
import ResponsiveImageService from 'ember-responsive-image/services/responsive-image';
import { ImageType, ProviderResult } from 'ember-responsive-image/types';
import { assert } from '@ember/debug';

interface CloudinaryConfig {
  cloudName: string;
}

interface CloudinaryOptions {
  transformations?: string;
  formats?: ImageType[];
}

export const provider = (
  image: string,
  service: ResponsiveImageService,
  options: CloudinaryOptions
): ProviderResult => {
  const cloudName =
    service.getProviderConfig<CloudinaryConfig>('cloudinary').cloudName;
  assert(
    'cloudName must be set for cloudinary provider!',
    typeof cloudName === 'string'
  );
  const imageId = image.replace(/\.[^/.]+$/, '');

  return {
    imageTypes: options.formats ?? ['png', 'jpeg', 'webp', 'avif'],
    imageUrlFor(width: number, type: ImageType = 'jpeg'): string {
      const params = [
        `w_${width}`,
        'c_limit',
        'q_auto',
        options.transformations,
      ];
      return `https://res.cloudinary.com/${cloudName}/image/upload/${params
        .filter(Boolean)
        .join(',')}/${imageId}.${type}`;
    },
  };
};

export default class ResponsiveImageCloudinaryProvider extends Helper {
  @service
  responsiveImage!: ResponsiveImageService;

  compute([image]: [string], options: CloudinaryOptions): ProviderResult {
    return provider(image, this.responsiveImage, options);
  }
}
