import  CryptoJS  from "crypto-js"
import  base64js  from "base64-js"
import * as fflate  from 'fflate'
import { Buffer } from 'buffer'

const UINT8ARRAY_PREFIX = [83,97,108,116,101,100,95,95];

function uint8Array2latin1 (arr) {
    return arr.reduce((str, code) => str + String.fromCharCode(code), '');
}

const lib = {
    encryptString(input, secret) {
        return this.encryptBinary((new TextEncoder()).encode(input), secret)
    },
    decryptAsString(input, secret) {
       return (new TextDecoder("utf-8")).decode(this.decryptBinary(input, secret));
    },
    encryptBinary(input, secret) {
        if (!(input instanceof Uint8Array)) {
            console.log(input);
            throw 'encryptBinary first argument must be a proper Uint8Array';
        }
        const compressedInput = fflate.zlibSync(input, { level: 9 });
        const latin1 = uint8Array2latin1(compressedInput);
        const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Latin1.parse(latin1), secret);
        const ciphertext = encrypted.toString();
        const output = base64js.toByteArray(ciphertext);
        return output.slice(UINT8ARRAY_PREFIX.length).reverse();
    },
    decryptBinary(input, secret) {
        if (!(input instanceof Uint8Array)) {
            console.log(input);
            throw 'encryptBinary first argument must be a proper Uint8Array';
        }
        input = new Uint8Array([...UINT8ARRAY_PREFIX].concat(...(input.reverse())));
        const ciphertext = base64js.fromByteArray(input);
        const decryptedString = CryptoJS.AES.decrypt(ciphertext, secret).toString(CryptoJS.enc.Latin1);
        const decryptedArray8 = Uint8Array.from(Buffer.from(decryptedString, 'latin1'));
        const output = fflate.unzlibSync(decryptedArray8);
        return output;
    },
    hash(data) {
        return CryptoJS.SHA512(data).toString();
    },
    hashPassword(id, password, token) {
        return lib.hash(id + password + token);
    },
    hashRandom(id, token) {
        return lib.hash(id + Math.random() + token);
    },
};
export default lib;