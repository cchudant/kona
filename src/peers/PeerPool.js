
module.exports = class PeerPool {
  constructor(torrent, peers, { limit = 5 } = {}) {
    this._limit = limit
    this._received = torrent
    this._peers = peers
  }

  download() {
    
  }
}
