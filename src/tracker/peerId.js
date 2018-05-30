const crypto = require('crypto')

let id = crypto.randomBytes(20)
Buffer.from('-kn0001-').copy(id, 0)

module.exports = id