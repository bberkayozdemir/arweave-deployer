# Arweave Deployer
Javascript library for uploading to arweave network easily with manifest generation.

## Installion

```sh
npm install arweave-deployer
```

## Usage

```js
import ArweaveDeployer, { TxTags } from "./ArweaveDeployer.js"

//initalize
var deployer = new ArweaveDeployer(Wallet, "arweave.net", 443, "https");

//load folder or file
var txs = await deployer.load("./folder");

//deploy
var deploy = await deployer.deploy();

//custom tags
let tags = new TxTags();
tags.addTag("MyCustomTagName", "MyCustomTagValue");
var txs = await deployer.load("./test", tags);
```