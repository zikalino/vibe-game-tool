import { BaseObject } from "../baseObject.js";

export class WaterObject extends BaseObject {
  create(amount) {
    return super.create({ water: amount });
  }
}
