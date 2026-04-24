import { BaseObject } from "../baseObject.js";

const STONE_TEXTURE_IMAGE_URL = "images/brick.png";

export class StoneObject extends BaseObject {
  constructor(tileType, stoneImage = createStoneTextureImage()) {
    super(tileType.STONE);
    this.stoneImage = stoneImage;
  }

  draw({ ctx, px, py, tileSize }) {
    if (isImageReady(this.stoneImage)) {
      ctx.drawImage(this.stoneImage, px, py, tileSize, tileSize);
      return;
    }

    ctx.fillStyle = "#7f868d";
    ctx.fillRect(px, py, tileSize, tileSize);
    ctx.fillStyle = "#6a7075";
    ctx.fillRect(px + 3, py + 3, tileSize - 6, tileSize - 6);
  }
}

function createStoneTextureImage() {
  if (typeof Image !== "function") {
    return null;
  }

  const image = new Image();
  image.src = STONE_TEXTURE_IMAGE_URL;
  return image;
}

function isImageReady(image) {
  return Boolean(image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
}
