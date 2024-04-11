"use strict";

const CoinKey = require('coinkey');
const ci = require('coininfo');
const fs = require('fs');
const crypto = require('crypto');
const cluster = require('cluster');
const numCPUs = 2;
const send = require('./message');
const axios = require('axios');

let counts = 0;
let recentKeys = []; // Array to store the 10 most recently generated keys
let lastRecentKeysUpdate = Date.now(); // Store the time when recentKeys were last updated

async function CheckBalanceDogecoin(address) {
    try {
        const response = await axios.get(`https://dogecoin.atomicwallet.io/api/v2/address/${address}`);
        if (response.status === 200) {
            return response.data.balance;
        } else {
            return 0;
        }
    } catch (error) {
        console.error("Error:", error);
        return 0;
    }
}

async function generate() {
    let privateKeyHex = crypto.randomBytes(32).toString('hex'); // Generate a random private key in hexadecimal format

    let ck = new CoinKey(Buffer.from(privateKeyHex, 'hex'), ci('DOGE').versions); // Create a new CoinKey object for Dogecoin using the generated private key

    ck.compressed = false; // Set false for uncompressed wallet addresses and true for compresed

    recentKeys.push({ address: ck.publicAddress, privateKey: ck.privateWif }); // Add the generated public address and private key in WIF format to recentKeys array
    if (recentKeys.length > 10) {
        recentKeys.shift(); // If recentKeys array has more than 10 elements, remove the first element
    }
    if (Date.now() - lastRecentKeysUpdate > 60000) {
        process.send({ recentKeys: recentKeys }); // If it has been more than a minute since recentKeys were last updated, send the updated recentKeys array to the master process
        lastRecentKeysUpdate = Date.now(); // Update lastRecentKeysUpdate time
    }

    const balance = await CheckBalanceDogecoin(ck.publicAddress);

    process.send({ address: ck.publicAddress, balance: `${balance} DOGE`});

    if (balance > 0) {
        console.log("");
        process.stdout.write('\x07');
        console.log("\x1b[32m%s\x1b[0m", ">> Success: " + ck.publicAddress);

        var successString = "Wallet: [" + ck.publicAddress + "] - Seed: [" + ck.privateWif + "] - Balance: " + balance + " DOGE";

        // save the wallet and its private key (seed) to a Success.txt file in the same folder 
        fs.writeFileSync('./match.txt', successString, (err) => {
            if (err) throw err;
        })

        send(successString, 'A Wallet Found Success!!!');
    }
}

if (cluster.isMaster) {
    cluster.on('message', (worker, message) => {
        counts++;
        if (message.address) {
            console.clear();
            console.log(`[${counts}] ${message.address}: ${message.balance}`);
        }
    });

    // Fork workers.
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork(); // Create a new worker process
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`); // Log when a worker process exits
    });
} else {
    setInterval(generate, 50); // Call the generate function repeatedly with no delay
}
