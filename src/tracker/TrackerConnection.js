const { createSocket } = require('dgram')
const { parse } = require('url')
const EventEmitter = require('events')
const { randomBytes } = require('crypto')
const TrackerError = require('./TrackerError')
const { peerId } = require('../protocolConstants')

const delay = t => new Promise(r => setTimeout(r, t))

const MAGIC = Buffer.allocUnsafe(8)
MAGIC.writeInt32BE(0x00000417, 0)
MAGIC.writeInt32BE(0x27101980, 4)

class TrackerConnection extends EventEmitter {
  constructor(url) {
    super()
    const { hostname, port } = parse(url)
    this._hostname = hostname
    this._port = port
    this._connectionId = MAGIC // unicorn
  }

  get connected() {
    return this._connected
  }

  get hostname() {
    return this._hostname
  }

  get port() {
    return this._port
  }

  /// handy functions ///

  async connect(options) {
    this._socket = createSocket('udp4')
    this._startMessageHandler()

    const { connectionId } = await this._protocolConnect(options)
    this._connectionId = connectionId
    this._connected = true
  }

  announce(data, options) {
    return this._protocolAnnounce(data, options)
  }

  async getPeers(torrent, port = 6881, options) {
    const { peers } = await this._protocolAnnounce({
      infoHash: torrent.infoHash,
      peerId,
      downloaded: Buffer.alloc(8),
      left: torrent.size,
      uploaded: Buffer.alloc(8),
      event: 0,
      ipAddress: 0,
      key: randomBytes(4),
      numWant: -1,
      port
    })

    return peers.map(({ ipAddress, tcpPort }) => ({
      ipAddress: ipAddress.join('.'),
      tcpPort
    }))
  }

  /// per packet protocol functions ///

  async _protocolConnect(options) {
    // write request
    const transaction = this._genTransaction()
    const request = Buffer.allocUnsafe(16)

    this._connectionId.copy(request, 0, 0, 8) // connection_id
    request.writeUInt32BE(0, 8) // action - connect
    request.writeUInt32BE(transaction, 12) // transaction_id

    // send & wait for response
    const { response } = await this._transaction(request, transaction, options)

    // read response
    if (response.length < 16)
      throw new TrackerError('The received response size is invalid')
    const connectionId = response.slice(8, 16) // connection_id

    return { connectionId }
  }

  async _protocolAnnounce(
    {
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
    },
    options
  ) {
    // write request
    const transaction = this._genTransaction()
    const request = Buffer.alloc(98)

    this._connectionId.copy(request, 0, 0, 8) // connection_id
    request.writeUInt32BE(1, 8) // action - announce
    request.writeUInt32BE(transaction, 12) // transaction_id
    infoHash.copy(request, 16, 0, 20) // info_hash
    peerId.copy(request, 36, 0, 20) // peer_id
    downloaded.copy(request, 56, 0, 8) // downloaded
    left.copy(request, 64, 0, 8) // left
    request.writeUInt32BE(uploaded, 72) // uploaded
    request.writeUInt32BE(event, 80) // event
    request.writeUInt32BE(ipAddress, 84) // IP address
    request.writeUInt32BE(key, 88) // key
    request.writeInt32BE(numWant, 92) // num_want
    request.writeUInt16BE(port, 96) // port

    // send & wait for response
    const { response } = await this._transaction(request, transaction, options)

    if (response.length < 20)
      throw new TrackerError('The received response size is invalid')

    // read response
    const interval = response.readUInt32BE(8) // interval
    const leechers = response.readUInt32BE(12) // leechers
    const seeders = response.readUInt32BE(16) // seeders

    if ((response.length - 20) % 6)
      throw new TrackerError('The received response size is invalid')

    const peers = []
    for (let n = 0; n < (response.length - 20) / 6; n++) {
      const ipAddress = response.slice(20 + 6 * n, 24 + 6 * n) // IP address
      const tcpPort = response.readUInt16BE(24 + 6 * n) // TCP port
      peers.push({ ipAddress, tcpPort })
    }

    return { interval, leechers, seeders, peers }
  }

  async _protocolScrape({ infoHashes }, options) {
    // write request
    const transaction = this._genTransaction()
    const request = Buffer.allocUnsafe(16 + 20 * infoHashes.length)

    this._connectionId.copy(request, 0, 0, 8) // connection_id
    request.writeUInt32BE(2, 8) // action - scrape
    request.writeUInt32BE(transaction, 12) // transaction_id
    // info_hash
    infoHashes.forEach((infoHash, n) =>
      Buffer.from(infoHash, 0, 20).copy(request, 16 + 20 * n, 0, 20)
    )

    // send & wait for response
    const { response } = await this._transaction(request, transaction, options)

    // read response
    if (response.length < 8 + 12 * infoHashes.length)
      throw new TrackerError('The received response size is invalid')
    const infoHashes = infoHashes.map((_, n) => ({
      seeders: response.readUInt32BE(8 + 12 * n),
      completed: response.readUInt32BE(12 + 12 * n),
      leechers: response.readUInt32BE(16 + 12 * n)
    }))

    return { infoHashes }
  }

  /// under the hood transaction management ///

  async _transaction(
    request,
    transaction,
    { timeout = 15000, trials = 8 } = {},
    n = 0
  ) {
    // send message
    await new Promise((rs, rj) =>
      this._socket.send(
        request,
        this._port,
        this._hostname,
        e => (e ? rj(e) : rs())
      )
    )

    // wait for response or timeout
    const res = await Promise.race([
      this._waitTransaction(transaction),
      delay(n < trials ? 2 ** n * timeout : timeout).then(() => false)
    ])

    if (!res) {
      // message not received
      if (n < trials)
        return this._transaction(
          request,
          transaction,
          { timeout, trials },
          n + 1
        )
      else throw new TrackerError("Can't connect to host.")
    } else {
      // message received
      return res
    }
  }

  _waitTransaction(transaction) {
    return new Promise(resolve => {
      const listener = obj => {
        // match the transaction
        if (obj.transactionId === transaction) {
          resolve(obj)
          this.removeListener('trackerResponse', listener) // remove listener
        }
      }

      this.on('trackerResponse', listener)
    })
  }

  _startMessageHandler() {
    this._socket.on('message', response => {
      if (response.length < 8) return // ignore incorrect packets

      // read packet header
      const action = response.readUInt32BE(0) // action
      const transactionId = response.readUInt32BE(4) // transaction_id

      this.emit('trackerResponse', { action, transactionId, response })
    })
  }

  _genTransaction() {
    return randomBytes(4).readUInt32BE(0)
  }
}

module.exports = TrackerConnection
