export class BaseObject {
  constructor(type) {
    this.type = type;
  }

  create(state = {}) {
    return { type: this.type, ...state };
  }

  tick() {}
}
