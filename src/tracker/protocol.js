

function connectWrite({ transactionId }) {
  const buffer = Buffer.alloc(16)

  buffer.writeUInt32BE(0x00000417, 0) // protocol_id - magic constant
  buffer.writeUInt32BE(0x27101980, 4)
  buffer.writeUInt32BE(0, 8) // action - connect
  buffer.writeUInt32BE(transactionId, 12) // transaction_id

  return buffer
}

function connectRead(buffer) {
  if (buffer.length !== 16)
    throw new TrackerError('The received response is invalid')

  const action = buffer.readUInt32BE(0) // action
  const transactionId = buffer.readUInt32BE(4) // transaction_id
  const connectionId = buffer.slice(8, 16) // connection_id

  if (action !== 0) throw new TrackerError('The action did not match')

  return { connectionId, transactionId }
}

function announceWrite({
  connectionId,
  transactionId,
  infoHash,
  peerId,
  downloaded,
  left,
  uploaded,
  event,
  ipAddress,
  key,
  numWant,
  port
}) {
  const buffer = Buffer.alloc(98)

  connectionId.copy(buffer, 0, 0, 8) // connection_id
  buffer.writeUInt32BE(1, 8) // action - connect
  buffer.writeUInt32BE(transactionId, 12) // transaction_id
  infoHash.copy(buffer, 16, 0, 20) // info_hash
  peerId.copy(buffer, 36, 0, 20) // peer_id
  buffer.writeUInt64BE(downloaded, 56) // downloaded
  buffer.writeUInt64BE(left, 64) // left
  buffer.writeUInt32BE(uploaded, 72) // uploaded
  buffer.writeUInt32BE(event, 80) // event
  buffer.writeUInt32BE(ipAddress, 84) // IP address
  buffer.writeUInt32BE(key, 88) // key
  buffer.writeUInt32BE(numWant, 92) // num_want
  buffer.writeUInt16BE(port, 96) // port

  return buffer
}

function announceRead(buffer, transaction) {
  if (buffer.length < 20)
    throw new TrackerError('The received response size is invalid')

  const action = buffer.readUInt32BE(0) // action
  const transactionId = buffer.readUInt32BE(4) // transaction_id
  const interval = buffer.readUInt32BE(8) // interval
  const leechers = buffer.readUInt32BE(12) // leechers
  const seedersLen = buffer.readUInt32BE(16) // seeders

  if (buffer.length !== 20 + 6 * seedersLen)
    throw new TrackerError('The received response size is invalid')

  const seeders = []
  for (let n = 0; n < seedersLen; n++) {
    const ipAddress = buffer.readUInt32BE(20 + 6 * n) // IP address
    const tcpPort = buffer.readUInt16BE(24 + 6 * n) // TCP port
    seeders.push({ ipAddress, tcpPort })
  }

  if (action !== 0) throw new TrackerError('The action did not match')
  if (transactionId !== transaction)
    throw new TrackerError('The transaction did not match')

  return { transactionId, interval, leechers, seeders }
}

module.exports = {
  connectWrite,
  connectRead,
  genTransaction
}
