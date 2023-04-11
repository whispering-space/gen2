import './style.css'
import axios from 'axios';
import encryption from './encryption.mjs';

const utils = {
  fetchDatabase(id, password) {
    const cryptoID = encryption.hashPassword(id, password, "1.0")
    return new Promise(function (resolve, reject) {
      axios.get('/db/'+cryptoID, {
        responseType: 'arraybuffer',
        headers: {
            'Content-Type': 'application/octet-stream',
            'Accept': 'application/octet-stream'
        }
      }).then(function({data}){
        resolve(encryption.decryptAsString(new Uint8Array(data), password));
      }).catch(reject);
    });
  }
}

const app = document.querySelector('#app')
console.log(await utils.fetchDatabase("guest", "guest"))