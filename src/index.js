const fs = require('fs')
const torrent = fs.readFileSync('alice.torrent')
console.log(torrent.toString())
