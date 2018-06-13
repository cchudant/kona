const fs = require('fs')
const bencode = require('bencode')
const TrackerConnection = require('./tracker/TrackerConnection')
const TorrentInfo = require('./torrent/TorrentInfo')
const PeerConnection = require('./peers/PeerConnection')

const torrent = new TorrentInfo(
  fs.readFileSync('gimp-2.10.2-setup.exe.torrent')
)

new TrackerConnection(torrent.announce)
  .connect()
  .then(() => conn.getPeers(torrent))
  .then(peers => {
    console.log(peers)
    const connection = new PeerConnection()
    return connection.connect().then(() => connection)
  })
  .catch(console.error)
