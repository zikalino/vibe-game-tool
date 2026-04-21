import { BaseObject } from "../baseObject.js";

export class StoneObject extends BaseObject {
  constructor(tileType) {
    super(tileType.STONE);
  }

  draw({ ctx, px, py, tileSize }) {
    ctx.fillStyle = "#7f868d";
    ctx.fillRect(px, py, tileSize, tileSize);
    ctx.fillStyle = "#6a7075";
    ctx.fillRect(px + 3, py + 3, tileSize - 6, tileSize - 6);
  }
}
