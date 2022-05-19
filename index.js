"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.TxTags = void 0;

var _fs = _interopRequireWildcard(require("fs"));

var _fastGlob = _interopRequireDefault(require("fast-glob"));

var _promisePool = _interopRequireDefault(require("@supercharge/promise-pool"));

var _crypto = _interopRequireDefault(require("crypto"));

var _mime = _interopRequireDefault(require("mime"));

var _Tags = _interopRequireDefault(require("./tags"));

var _path = _interopRequireDefault(require("path"));

var _promises = require("stream/promises");

var _arweaveStreamTx = require("arweave-stream-tx");

var _arweave = _interopRequireDefault(require("arweave"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

class ArweaveDeployer {
  constructor(wallet, host, port, protocol, threads = 5) {
    this.txs = [];
    this.wallet = wallet;
    this.threads = threads;
    this.arweave = _arweave.default.init({
      host: host,
      port: port,
      protocol: protocol
    });
  }

  async load(location, tags = new _Tags.default()) {
    let dir = _path.default.resolve(process.cwd(), location.replace(/[\/\\]$/, ''));

    let files = [dir];
    this.isFile = true;

    if (_fs.default.lstatSync(dir).isDirectory()) {
      files = await (0, _fastGlob.default)([`${location}/**/*`], {
        dot: false
      });
      this.isFile = false;
    }

    await _promisePool.default.for(files).withConcurrency(this.threads).process(async path => {
      let data;

      try {
        data = _fs.default.readFileSync(path);
      } catch (err) {
        throw new Error(`Unable to read file: ${path}`);
      }

      if (!data || !data.length) return;
      const hash = await this.toHash(data);
      const type = _mime.default.getType(path) || 'application/octet-stream';

      const _tags = new _Tags.default();

      for (const tag of tags.tags) _tags.addTag(tag.name, tag.value);

      _tags.addTag('User-Agent', "arweave-deployer");

      _tags.addTag('User-Agent-Version', "0.0.1");

      _tags.addTag('Type', 'file');

      if (type) _tags.addTag('Content-Type', type);

      _tags.addTag('File-Hash', hash);

      let size;
      let tx;
      tx = await this.buildTransaction(path, _tags);
      size = parseInt(tx.data_size, 10);
      this.txs.push({
        path,
        hash,
        tx,
        type,
        size
      });
    });
    await this.buildManifest(location, tags);
    return this.txs;
  }

  async deploy() {
    let txid = this.txs[0].tx.id;

    if (!this.isFile) {
      for (let i = 0, j = this.txs.length; i < j; i++) {
        if (this.txs[i].path === '' && this.txs[i].hash === '') {
          txid = this.txs[i].tx.id;
          break;
        }
      }
    }

    let toDeploy = this.txs;
    await _promisePool.default.for(toDeploy).withConcurrency(this.threads).process(async txData => {
      let deployed = false;

      if (!(txData.path === '' && txData.hash === '')) {
        try {
          await (0, _promises.pipeline)((0, _fs.createReadStream)(txData.path), (0, _arweaveStreamTx.uploadTransactionAsync)(txData.tx, this.arweave));
          deployed = true;
        } catch (e) {}
      }

      if (!deployed) {
        let uploader = await this.arweave.transactions.getUploader(txData.tx);

        try {
          while (!uploader.isComplete) {
            await uploader.uploadChunk();
          }

          deployed = true;
        } catch (err) {
          if (uploader.lastResponseStatus > 0) {
            return console.error({
              status: uploader.lastResponseStatus,
              statusText: uploader.lastResponseError
            });
          }

          throw err;
        }
      }
    });
    return {
      id: txid,
      transactions: this.txs.map(x => {
        x.id = x.tx.id;
        delete x.tx;
        return x;
      })
    };
  }

  async toHash(data) {
    const hash = _crypto.default.createHash('sha256');

    hash.update(data);
    return hash.digest('hex');
  }

  async buildTransaction(path, tags) {
    const tx = await (0, _promises.pipeline)((0, _fs.createReadStream)(path), (0, _arweaveStreamTx.createTransactionAsync)({}, this.arweave, this.wallet));
    tags.addTagsToTransaction(tx);
    await this.arweave.transactions.sign(tx, this.wallet);
    return tx;
  }

  async buildManifest(dir, tags) {
    const {
      results: pTxs
    } = await _promisePool.default.for(this.txs).withConcurrency(this.threads).process(async txD => {
      const path = txD.path.split(`${dir}/`)[1];
      return [path, {
        id: txD.tx.id
      }];
    });
    const paths = pTxs.reduce((acc, cur) => {
      acc[cur[0]] = cur[1];
      return acc;
    }, {});
    let index = Object.keys(paths)[0];
    if (Object.keys(paths).includes('index.html')) index = 'index.html';
    const data = {
      manifest: 'arweave/paths',
      version: '0.1.0',
      index: {
        path: index
      },
      paths
    };
    tags.addTag('Type', 'manifest');
    tags.addTag('Content-Type', 'application/x.arweave-manifest+json');
    let tx;
    tx = await this.arweave.createTransaction({
      data: JSON.stringify(data)
    }, this.wallet);
    tags.addTagsToTransaction(tx);
    await this.arweave.transactions.sign(tx, this.wallet);
    this.txs.push({
      path: '',
      hash: '',
      tx,
      type: 'application/x.arweave-manifest+json'
    });
    return true;
  }

}

exports.default = ArweaveDeployer;
const TxTags = _Tags.default;
exports.TxTags = TxTags;