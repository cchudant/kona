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
        .slice(0, 5)
        .map(({ ipAddress, tcpPort }) =>
          new PeerConnection(ipAddress, tcpPort).connect(torrent)
            .then(conn => {
              console.log(conn)
              return conn
            })
            .catch(e => {
              console.log(e)
              return e
            })
        )
    )
  })
  .then(all => {
    console.log(' yess ', all)
  })
  .catch(console.error)
