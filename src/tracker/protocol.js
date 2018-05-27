const { randomBytes } = require('crypto')

function genTransaction() {
  return randomBytes(4).readUInt32BE(0)
}

function connectWrite(transaction) {
  const buffer = Buffer.alloc(16)

  // protocol_id
  buffer.writeUInt32BE(0x417, 0) //magic constant
  buffer.writeUInt32BE(0x27101980, 4)

  // action
  buffer.writeUInt32BE(0, 8) //connect

  // transaction_id
  buffer.writeUInt32BE(transaction, 12)

  return buffer
}

function connectRead(buffer, transaction) {
  if (buffer.length !== 16)
    throw new TrackerError('The received response is invalid')

  // action
  const action = buffer.readUInt32BE(0)
  if (action !== 0)
    //connect
    throw new TrackerError('The action did not match')

  // transaction_id
  const transactionId = buffer.readUInt32BE(4)
  if (transactionId !== transaction)
    throw new TrackerError('The transaction did not match')

  // coonnection_id
  return buffer.slice(8, 16)
}

function announceWrite(
  connectionId,
  transactionId,
  infoHash,
  peerId,
  downloaded,
  left,
  uploaded,
  event
) {
  const buffer = Buffer.alloc(98)

  // connection_id
  connectionId.copy(buffer, 0)

  // action
  buffer.writeUInt32BE(1, 8) //connect

  // transaction_id
  buffer.writeUInt32BE(transactionId, 12)

  // info_hash
  infoHash.copy(buffer, 16)

  // peer_id
  peerId.copy(buffer, 36)

  // peer_id

  return buffer
}

function sendUdp(socket, message, hostname, port) {
  return new Promise((resolve, reject) => {
    socket.send(message, port, hostname, err => {
      err ? reject(err) : resolve(message.length)
    })
  })
}

function awaitMessage(socket) {
  return new Promise(resolve => socket.once('message', resolve))
}

module.exports = {
  connectWrite,
  connectRead,
  genTransaction,
  sendUdp,
  awaitMessage
}
