const fs = require('fs')
const bencode = require('bencode')
const TrackerConnection = require('./tracker/TrackerConnection')
const TorrentInfo = require('./torrent/TorrentInfo')

const torrent = new TorrentInfo(
  fs.readFileSync('gimp-2.10.2-setup.exe.torrent')
)

const conn = new TrackerConnection('udp://tracker.leechers-paradise.org:6969')
console.log(conn)
conn.connect().then(() => {
  console.log('connected')
  return conn.announce(torrent)
})
.catch(console.error)
