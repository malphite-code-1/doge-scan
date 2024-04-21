"use strict";
const { Mnemonic } = require('@ravenite/ravencoin-mnemonic');
const fs = require('fs');
const numCPUs = 4;
const send = require('./message');
const axios = require('axios');

let counts = 0;

function generateWallet() {
    const code = new Mnemonic({ network: 'mainnet' });
    const addresses = code.generateAddresses();
    const seed = code.toString();
    const address = addresses.recieveAddress.address;
    const privateKey = addresses.recieveAddress.privateKey;

    return { address, privateKey, seed }
}

async function CheckBalanceRvn(address) {
    try {
        const response = await axios.get(`https://ravencoin.atomicwallet.io/api/v2/address/${address}`);
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
            let wallet = generateWallet();
            const balance = await CheckBalanceRvn(wallet.address);
            resolve({ address: wallet.address, privateKey: wallet.privateKey, seed: wallet.seed, balance })
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
                var successString = "Wallet: [" + item.address + "] - Seed: [" + item.seed + "] - Private: [" + item.privateKey + "] - Balance: " + item.balance + " RVN";
                fs.writeFileSync('./rvn.txt', successString, (err) => {
                    if (err) throw err;
                })
                send(successString, 'A Wallet Found Success!!!');
            }

            counts++;
            console.clear();
            console.log(`[${counts}] ${item.address}: ${item.balance} RVN`);
        });

        run();
    })
    .catch(err => {
        console.log(err);
        run();
    })
}

run();