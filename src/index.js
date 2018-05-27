const fs = require('fs')
const bencode = require('bencode')
const TrackerConnection = require('./tracker/TrackerConnection')

const torrent = bencode.decode(fs.readFileSync('gimp-2.10.2-setup.exe.torrent'))

const url = torrent.announce.toString()

const conn = new TrackerConnection(url)
conn.connect()
