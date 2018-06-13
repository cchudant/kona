const { Socket } = require('net')
const EventEmitter = require('events')
const { pstr } = require('../protocolConstants')

const reserved = Buffer.alloc(8)

module.exports = class PeerConnection extends EventEmitter {
  constructor(host, port) {
    super()
    this._host = host
    this._port = port
  }

  async connect() {
    // connect
    await this._connect()

    // handshake
    await this._protocolHandshake({ pstr, reserved })
  }

  _connect() {
    this._socket = new Socket()

    return new Promise((rs, rj) => {
      // reject on connection error
      this._socket.once('error', rj)

      // resolve on connect
      this._socket.connect(this._port, this._host, () => {
        this._socket.removeListener('error', rj)
        rs()
      })
    })
  }

  /// per packet protocol functions ///

  async _protocolHandshake({ pstr, reserved, infoHash, peerId }) {
    // write request
    const transaction = this._genTransaction(49 + pstr.length)
    const request = Buffer.allocUnsafe(pstr.length + 49)

    request.writeUInt8(0, pstr.length) // pstrlen
    pstr.copy(request, 1) // pstr
    reserved.copy(request, pstr.length + 1, 0, 8) // reserved
    infoHash.copy(request, pstr.length + 9, 0, 20) // info_hash
    preerId.copy(request, pstr.length + 29, 0, 20) // peer_id

    this._send(request, options)
    await this._waitResponse(true)

    // read response
    if (response.length < 16)
      throw new TrackerError('The received response size is invalid')
    const connectionId = response.slice(8, 16) // connection_id

    return { connectionId }
  }

  /// under the hood transaction management ///

  _send(request) {
    return new Promise((rs, rj) =>
      this._socket.write(request, e => (e ? rj(e) : rs()))
    )
  }

  _waitResponse(handshake = false) {
    return new Promise((resolve, reject) => {

      const handler = response => {
        // handshake packet is not length-prefixed
        let len = this._buffer && (handshake ? this._buffer.readUInt8(0) + 49 : this._buffer.readInt32BE(0) + 4)

        this._buffer = len ? this._buffer.concat([this._buffer, response]) : response

        if (this._buffer.length >= len) {
          const packet = this._buffer.slice(0, len)
          this._buffer = this._buffer.slice(len)

          this._socket.removeListener('data', handler)
          resolve(packet)
        }
      }
      this._socket.on('data', handler)
    })
  }
}
