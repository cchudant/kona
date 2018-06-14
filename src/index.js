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
  .then(conn => conn.getPeers(torrent))
  .then(peers => {
    console.log(peers)
    return Promise.all(
      peers
        .slice(0, 20)
        .map(({ ipAddress, tcpPort }) =>
          new PeerConnection(ipAddress, tcpPort).connect(torrent)
            .catch(e => e)
        )
    )
  })
  .then(all => {
    console.log(' yess ', all.filter(e => e instanceof PeerConnection).length)
  })
  .catch(console.error)
