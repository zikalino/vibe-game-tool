import { BaseObject } from "../baseObject.js";

export class GoalObject extends BaseObject {
  constructor(tileType) {
    super(tileType.GOAL);
  }

  draw({ ctx, px, py, tileSize }) {
    ctx.fillStyle = "#f4cb3e";
    ctx.fillRect(px, py, tileSize, tileSize);
    ctx.fillStyle = "#fff3ae";
    ctx.fillRect(px + 8, py + 8, 16, 16);
    ctx.fillStyle = "#8f6f00";
    ctx.fillRect(px + 13, py + 13, 6, 6);
  }
}
