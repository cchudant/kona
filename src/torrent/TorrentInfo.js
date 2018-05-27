const bencode = require('bencode')

const toast = o => o && o.toString()

const fieldMapping = {
  announce: torrent => toast(torrent['announce']),
  announceList: torrent =>
    (torrent['announce-list'] || []).map(toast),
  creationDate: torrent => torrent['creation date'],
  comment: torrent => toast(torrent['comment']),
  createdBy: torrent => toast(torrent['created by']),
  encoding: torrent => toast(torrent['encoding'])
}

class TorrentInfo {
  constructor(torrent) {
    if (torrent instanceof Buffer) {
      torrent = bencode.decode(torrent)
    }

    console.log(torrent)

    Object.entries(fieldMapping).forEach(
      ([field, mapper]) => (this[field] = mapper(torrent))
    )
  }
}


module.exports = TorrentInfo
