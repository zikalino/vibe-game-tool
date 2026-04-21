import { BaseObject } from "../baseObject.js";

export class WaterObject extends BaseObject {
  create(amount) {
    return super.create({ water: amount });
  }

  draw({ ctx, tile, px, py, tileSize }) {
    ctx.fillStyle = "#e8f2ff";
    ctx.fillRect(px, py, tileSize, tileSize);

    const shownWater = Math.min(1, tile.water);
    const h = Math.max(1, Math.floor(shownWater * tileSize));
    ctx.fillStyle = "#4f9ce5";
    ctx.fillRect(px, py + tileSize - h, tileSize, h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(px + 2, py + tileSize - h + 1, tileSize - 4, 2);
  }
}
