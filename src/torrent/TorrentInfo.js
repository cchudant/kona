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

// https://wiki.theory.org/index.php/BitTorrentSpecification#Metainfo_File_Structure
class TorrentInfo {
  constructor(torrent) {
    if (torrent instanceof Buffer) {
      torrent = bencode.decode(torrent)
    }

    console.log(torrent)
    console.log(convBuffers(torrent))

    Object.entries(fieldMapping).forEach(
      ([field, mapper]) => (this[field] = mapper(torrent))
    )
  }
}

function convBuffers(raw) {
  if (raw instanceof Array) {
    return raw.map(v => v instanceof Buffer ? v.toString() : convBuffers(v))
  }

  if (raw instanceof Object) {
    return Array.from(Object.entries(raw))
      .map(([k, v]) => [k, v instanceof Buffer ? v.toString() : convBuffers(v)])
      .reduce((o, [k, v]) => (o[k] = v, o), {})
  }

  return raw
}

module.exports = TorrentInfo
