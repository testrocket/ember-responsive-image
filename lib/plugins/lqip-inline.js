const sharp = require('sharp');
const dataUri = require('../utils/data-uri');
const blurrySvg = require('../utils/blurry-svg');
const normalizePath = require('../utils/normalize-path');

class LqipInlinePlugin {
  constructor(addon) {
    this.processed = [];
    this.metaData = new Map();

    addon.addMetadataExtension(this.addMetaData, this);
    addon.addImagePreProcessor(this.imagePreProcessor, this);
    addon.addCssExtension(this.addCss, this);
  }

  canProcessImage(config) {
    return config.lqip && config.lqip.type === 'inline';
  }

  async getLqipDimensions(config, sharped) {
    const meta = await sharped.metadata();
    const targetPixels = config.lqip.targetPixels || 60;
    const aspectRatio = meta.width / meta.height;

    // taken from https://github.com/google/eleventy-high-performance-blog/blob/5ed39db7fd3f21ae82ac1a8e833bf283355bd3d0/_11ty/blurry-placeholder.js#L74-L92
    let bitmapHeight = targetPixels / aspectRatio;
    bitmapHeight = Math.sqrt(bitmapHeight);
    const bitmapWidth = targetPixels / bitmapHeight;
    return { width: Math.round(bitmapWidth), height: Math.round(bitmapHeight) };
  }

  async imagePreProcessor(sharped, image, _width, config) {
    if (this.processed.includes(image) || !this.canProcessImage(config)) {
      return sharped;
    }
    this.processed.push(image);

    const { width, height } = await this.getLqipDimensions(config, sharped);
    const buffer = await sharped.toBuffer();
    const lqi = await sharp(buffer)
      .resize(width, height, {
        withoutEnlargement: true,
        fit: 'fill',
      })
      .png();

    const sharpMeta = await lqi.metadata();

    const meta = {
      type: 'inline',
      image: (await lqi.toBuffer()).toString('base64'),
      width: sharpMeta.width,
      height: sharpMeta.height,
    };

    this.metaData.set(normalizePath(image), meta);

    return sharped;
  }

  addMetaData(image, metadata /*, config*/) {
    const ourMeta = this.metaData.get(image);
    if (ourMeta) {
      metadata.lqip = { type: 'inline', class: ourMeta.class };
    }

    return metadata;
  }

  addCss(image, metaData, { generateClassName }) {
    const ourMeta = this.metaData.get(image);
    if (ourMeta) {
      const className = generateClassName();
      ourMeta.class = className;
      const uri = dataUri(
        blurrySvg(
          dataUri(ourMeta.image, 'image/png', true),
          ourMeta.width,
          ourMeta.height
        ),
        'image/svg+xml'
      );
      return `.${className} { background-image: url(${uri}); }`;
    }

    return undefined;
  }
}

module.exports = LqipInlinePlugin;
