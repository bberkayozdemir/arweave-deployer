"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class Tags {
  constructor() {
    _defineProperty(this, "_tags", new Map());

    this._tags = new Map();
  }

  get tags() {
    return Array.from(this._tags.entries()).map(([name, value]) => ({
      name,
      value
    }));
  }

  addTag(key, value) {
    this._tags.set(key, value);
  }

  addTags(tags) {
    tags.forEach(({
      name,
      value
    }) => this.addTag(name, value));
  }

  addTagsToTransaction(tx) {
    this.tags.forEach(({
      name,
      value
    }) => tx.addTag(name, value));
  }

}

exports.default = Tags;