const fs = require('fs')
const bencode = require('bencode')
const TrackerConnection = require('./tracker/TrackerConnection')
const TorrentInfo = require('./torrent/TorrentInfo')

const torrent = new TorrentInfo(
  fs.readFileSync('gimp-2.10.2-setup.exe.torrent')
)

new TrackerConnection(torrent.announce)
  .connect()
  .then(() => conn.getPeers(torrent))
  .then(peers => {
    console.log(peers)
  })
  .catch(console.error)
