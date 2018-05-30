const { createSocket } = require('dgram')
const { parse } = require('url')
const EventEmitter = require('events')
const { randomBytes } = require('crypto')
const TrackerError = require('./TrackerError')

const delay = t => new Promise(r => setTimeout(r, t))

class TrackerConnection extends EventEmitter {
  constructor(url) {
    super()
    const { hostname, port } = parse(url)
    this._hostname = hostname
    this._port = port
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

  /// per packet protocol functions ///

  async connect({ timeout = 15000, trials = 8 } = {}) {
    this._socket = createSocket('udp4')
    this._startMessageHandler()

    // write request
    const transaction = this._genTransaction()
    const request = Buffer.allocUnsafe(16)
  
    request.writeUInt32BE(0x00000417, 0) // protocol_id - magic constant
    request.writeUInt32BE(0x27101980, 4)
    request.writeUInt32BE(0, 8) // action - connect
    request.writeUInt32BE(transaction, 12) // transaction_id

    // send & wait for response
    const { response } = await this._transaction(request, transaction, { timeout, trials })

    // read response
    const connectionId = response.slice(8, 16) // connection_id

    this._connectionId = connectionId
    this._connected = true
  }

  /// under the hood transaction management /// 

  async _transaction(request, transaction, { timeout, trials }, n = 0) {
    // send message
    console.log('send')
    await new Promise((rs, rj) =>
      this._socket.send(request, this._port, this._hostname, e => e ? rj(e) : rs())
    )
    console.log('sent')

    // wait for response or timeout
    const res = await Promise.race([
      this._waitTransaction(transaction),
      delay(n < trials ? 2 ** n * timeout : timeout).then(() => {})
    ])
    console.log('res', res)

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
      console.log(response)

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
