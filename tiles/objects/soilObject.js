import { BaseObject } from "../baseObject.js";

export class SoilObject extends BaseObject {
  constructor(tileType) {
    super(tileType.SOIL);
  }

  draw({ ctx, px, py, tileSize }) {
    ctx.fillStyle = "#9f7746";
    ctx.fillRect(px, py, tileSize, tileSize);
    ctx.fillStyle = "#835e35";
    for (let i = 0; i < 4; i += 1) {
      ctx.fillRect(px + 5 + i * 6, py + 5 + (i % 2) * 8, 2, 2);
    }
  }
}
