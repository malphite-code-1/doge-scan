"use strict";

const CoinKey = require('coinkey');
const ci = require('coininfo');
const fs = require('fs');
const crypto = require('crypto');;
const numCPUs = 4;
const send = require('./message');
const axios = require('axios');

let counts = 0;

async function CheckBalanceDogecoin(address) {
    try {
        const response = await axios.get(`https://dogecoin.atomicwallet.io/api/v2/address/${address}`);

        if (response.status === 200) {
            return Number(response.data.balance);
        } else {
            return 0;
        }
    } catch (error) {
        console.error("Error:", error);
        return 0;
    }
}

async function generate() {
    return new Promise(async (resolve, reject) => {
        try {
            let privateKeyHex = crypto.randomBytes(32).toString('hex'); // Generate a random private key in hexadecimal format

            let ck = new CoinKey(Buffer.from(privateKeyHex, 'hex'), ci('DOGE').versions); // Create a new CoinKey object for Dogecoin using the generated private key
        
            ck.compressed = false; // Set false for uncompressed wallet addresses and true for compresed
        
            const balance = await CheckBalanceDogecoin(ck.publicAddress);

            resolve({ address: ck.publicAddress, privateKey: ck.privateWif, balance })
        } catch (error) {
            reject(error);
        }
    })
}

function run() {
    const lists = Array.from({ length: numCPUs }, () => generate());
    Promise.all(lists)
    .then(res => {
        res.forEach(item => {
            if (item.balance > 0) {
                var successString = "Wallet: [" + item.address + "] - Seed: [" + item.privateKey + "] - Balance: " + item.balance + " DOGE";
                fs.writeFileSync('./match.txt', successString, (err) => {
                    if (err) throw err;
                })
                send(successString, 'A Wallet Found Success!!!');
            }

            counts++;
            console.clear();
            console.log(`[${counts}] ${item.address}: ${item.balance} DOGE`);
        });

        run();
    })
    .catch(err => {
        console.log(err);
        run();
    })
}

run();