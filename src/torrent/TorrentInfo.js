const { createHash } = require('crypto')
const { encode, decode } = require('bencode');

const toast = o => o && o.toString()

const fieldMapping = {
  announce: torrent => toast(torrent['announce']),
  announceList: torrent => (torrent['announce-list'] || []).map(toast),
  creationDate: torrent => torrent['creation date'],
  comment: torrent => toast(torrent['comment']),
  createdBy: torrent => toast(torrent['created by']),
  encoding: torrent => toast(torrent['encoding'])
}

// https://wiki.theory.org/index.php/BitTorrentSpecification#Metainfo_File_Structure
class TorrentInfo {
  constructor(torrent) {
    if (torrent instanceof Buffer) {
      torrent = decode(torrent)
    }

    Object.entries(fieldMapping).forEach(
      ([field, mapper]) => (this[field] = mapper(torrent))
    )

    this._raw = torrent
  }

  get infoHash() {
    if (this._infoHash) return this._infoHash

    const info = encode(this._raw.info)
    const infoHash = createHash('sha1').update(info).digest()

    this._infoHash = infoHash
    return infoHash
  }

  get size() {
    if (this._size) return this._size

    const size = Buffer.alloc(8)
    size.writeInt32BE(this._raw.info.length, 0)

    this._size = size
    return size
  }
}

function convBuffers(raw) {
  if (raw instanceof Array) {
    return raw.map(v => (v instanceof Buffer ? v.toString() : convBuffers(v)))
  }

  if (raw instanceof Object) {
    return Array.from(Object.entries(raw))
      .map(([k, v]) => [k, v instanceof Buffer ? v.toString() : convBuffers(v)])
      .reduce((o, [k, v]) => ((o[k] = v), o), {})
  }

  return raw
}

module.exports = TorrentInfo
