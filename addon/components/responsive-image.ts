import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import ResponsiveImageService, {
  ImageMeta,
  ImageType,
  LqipBlurhash,
  Meta,
} from 'ember-responsive-image/services/responsive-image';
import { assert } from '@ember/debug';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { getOwnConfig, macroCondition } from '@embroider/macros';

declare module '@embroider/macros' {
  export function getOwnConfig(): { usesBlurhash: boolean };
}

declare global {
  const __eri_blurhash: {
    bh2url: (hash: string, width: number, height: number) => string | undefined;
  };
}

interface ResponsiveImageComponentArgs {
  src: string;
  size?: number;
  sizes?: string;
  width?: number;
  height?: number;
  cacheBreaker?: string;
}

interface PictureSource {
  srcset: string;
  type: ImageType;
  mimeType: string;
  sizes?: string;
}

enum Layout {
  RESPONSIVE = 'responsive',
  FIXED = 'fixed',
}

const PIXEL_DENSITIES = [1, 2];

// determines the order of sources, prefereing next-gen formats over legacy
const typeScore = new Map<ImageType, number>([
  ['png', 1],
  ['jpeg', 1],
  ['webp', 2],
  ['avif', 3],
]);

export default class ResponsiveImageComponent extends Component<ResponsiveImageComponentArgs> {
  @service
  responsiveImage!: ResponsiveImageService;

  @tracked
  isLoaded = false;

  constructor(owner: unknown, args: ResponsiveImageComponentArgs) {
    super(owner, args);
    assert('No image argument supplied for <ResponsiveImage>', args.src);
  }

  get layout(): Layout {
    return this.args.width === undefined && this.args.height === undefined
      ? Layout.RESPONSIVE
      : Layout.FIXED;
  }

  get sources(): PictureSource[] {
    if (this.layout === Layout.RESPONSIVE) {
      return this.responsiveImage
        .getAvailableTypes(this.args.src)
        .map((type) => {
          const sources: string[] = this.responsiveImage
            .getImages(this.args.src, type)
            .map(
              (imageMeta) =>
                `${imageMeta.image}${
                  this.args.cacheBreaker ? '?' + this.args.cacheBreaker : ''
                } ${imageMeta.width}w`
            );

          return {
            srcset: sources.join(', '),
            sizes:
              this.args.sizes ??
              (this.args.size ? `${this.args.size}vw` : undefined),
            type,
            mimeType: `image/${type}`,
          };
        });
    } else {
      const width = this.width;
      if (width === undefined) {
        return [];
      }

      return this.responsiveImage
        .getAvailableTypes(this.args.src)
        .map((type) => {
          const sources: string[] = PIXEL_DENSITIES.map((density) => {
            const imageMeta = this.responsiveImage.getImageMetaByWidth(
              this.args.src,
              width * density,
              type
            )!;

            return `${imageMeta.image}${
              this.args.cacheBreaker ? '?' + this.args.cacheBreaker : ''
            } ${density}x`;
          }).filter((source) => source !== undefined);

          return {
            srcset: sources.join(', '),
            type,
            mimeType: `image/${type}`,
          };
        });
    }
  }

  get sourcesSorted(): PictureSource[] {
    return this.sources.sort(
      (a, b) => (typeScore.get(b.type) ?? 0) - (typeScore.get(a.type) ?? 0)
    );
  }

  get imageMeta(): ImageMeta | undefined {
    if (this.layout === Layout.RESPONSIVE) {
      return this.responsiveImage.getImageMetaBySize(
        this.args.src,
        this.args.size
      );
    } else {
      return this.responsiveImage.getImageMetaByWidth(
        this.args.src,
        this.width ?? 0
      );
    }
  }

  get meta(): Meta {
    return this.responsiveImage.getMeta(this.args.src);
  }

  /**
   * the image source which fits at best for the size and screen
   */
  get src(): string | undefined {
    return this.imageMeta
      ? `${this.imageMeta.image}${
          this.args.cacheBreaker ? '?' + this.args.cacheBreaker : ''
        }`
      : undefined;
  }

  get width(): number | undefined {
    if (this.layout === Layout.RESPONSIVE) {
      return this.imageMeta?.width;
    } else {
      if (this.args.width) {
        return this.args.width;
      }

      const ar = this.responsiveImage.getAspectRatio(this.args.src);
      if (ar !== undefined && ar !== 0 && this.args.height !== undefined) {
        return this.args.height * ar;
      }

      return undefined;
    }
  }

  get height(): number | undefined {
    if (this.layout === Layout.RESPONSIVE) {
      return this.imageMeta?.height;
    } else {
      if (this.args.height) {
        return this.args.height;
      }

      const ar = this.responsiveImage.getAspectRatio(this.args.src);
      if (ar !== undefined && ar !== 0 && this.args.width !== undefined) {
        return this.args.width / ar;
      }

      return undefined;
    }
  }

  get classNames(): string {
    const classNames = [`eri-${this.layout}`];
    const lqip = this.meta.lqip;
    if (lqip && !this.isLoaded) {
      classNames.push(`eri-lqip-${lqip.type}`);
      if (lqip.type === 'color' || lqip.type === 'inline') {
        classNames.push(lqip.class);
      }
    }

    return classNames.join(' ');
  }

  get hasLqipBlurhash(): boolean {
    if (macroCondition(getOwnConfig().usesBlurhash)) {
      return this.meta.lqip?.type === 'blurhash';
    } else {
      return false;
    }
  }

  get showLqipBlurhash(): boolean {
    return !this.isLoaded && this.hasLqipBlurhash;
  }

  get blurhashMeta(): LqipBlurhash | undefined {
    if (macroCondition(getOwnConfig().usesBlurhash)) {
      return this.meta.lqip?.type === 'blurhash' ? this.meta.lqip : undefined;
    } else {
      return undefined;
    }
  }

  get lqipBlurhash(): string | undefined {
    if (macroCondition(getOwnConfig().usesBlurhash)) {
      if (!this.hasLqipBlurhash) {
        return undefined;
      }
      const { hash, width, height } = (this.meta as Required<Meta>)
        .lqip as LqipBlurhash;
      const uri = __eri_blurhash.bh2url(hash, width, height);

      return `url("${uri}")`;
    } else {
      return undefined;
    }
  }

  @action
  onLoad(): void {
    this.isLoaded = true;
  }
}
