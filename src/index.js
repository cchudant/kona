const fs = require('fs')
const bencode = require('bencode')
const TrackerConnection = require('./tracker/TrackerConnection')
const TorrentInfo = require('./torrent/TorrentInfo')

const torrent = new TorrentInfo(
  fs.readFileSync('gimp-2.10.2-setup.exe.torrent')
)

// const conn = new TrackerConnection(url)
// conn.connect()
