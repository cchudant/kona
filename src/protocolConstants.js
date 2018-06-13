const crypto = require('crypto')

const peerId = crypto.randomBytes(20)
Buffer.from('-kn0001-').copy(peerId, 0)

module.exports = { peerId, pstr: Buffer.from('BitTorrent protocol') }
