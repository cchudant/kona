const crypto = require('crypto')

const id = crypto.randomBytes(20)
Buffer.from('-kn0001-').copy(id, 0)

module.exports = { peerId, pstr: 'BitTorrent protocol' }
