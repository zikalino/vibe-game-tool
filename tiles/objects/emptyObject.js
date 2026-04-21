import { BaseObject } from "../baseObject.js";

export class EmptyObject extends BaseObject {
  constructor(tileType) {
    super(tileType.EMPTY);
  }

  draw({ ctx, px, py, tileSize }) {
    ctx.fillStyle = "#f2efe7";
    ctx.fillRect(px, py, tileSize, tileSize);
  }
}
