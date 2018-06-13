const { Socket } = require('net')
const EventEmitter = require('events')
const { pstr, peerId } = require('../protocolConstants')
const PeerError = require('./PeerError')

const reserved = Buffer.alloc(8)

module.exports = class PeerConnection extends EventEmitter {
  constructor(host, port) {
    super()
    this._host = host
    this._port = port

    console.log(`host: ${this._host} port: ${this._port}`)

    this._socket = new Socket()
  }

  connect({ infoHash }) {
    return this.catchErrorEvent(async () => {
      // connect
      await this._connect()
      console.log(`host: ${this._host} port: ${this._port} Connected!`)
  
      // handshake
      const {
        pstr: recP,
        infoHash: recHash,
        peerId: recId
      } = await this._protocolHandshake({ pstr, reserved, infoHash, peerId })
  
      if (!pstr.equals(recP))
        throw new PeerError('Protocol not supported: ' + recP)
      if (!recHash.equals(infoHash))
        throw new PeerError('Wrong infoHash received: ' + infoHash)
      if (!recId.equals(peerId))
        throw new PeerError('Wrong peer id received: ' + peerId)
  
      return this
    })
  }

  _connect() {
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
    const request = Buffer.allocUnsafe(pstr.length + 49)

    request.writeUInt8(0, pstr.length) // pstrlen
    pstr.copy(request, 1) // pstr
    reserved.copy(request, pstr.length + 1, 0, 8) // reserved
    infoHash.copy(request, pstr.length + 9, 0, 20) // info_hash
    peerId.copy(request, pstr.length + 29, 0, 20) // peer_id

    // write & wait for response
    this._socket.write(request)
    console.log(`host: ${this._host} port: ${this._port} Handshake written!`)
    console.log(request)
    const response = await this._waitResponse(true)
    console.log(`host: ${this._host} port: ${this._port} Response!`)

    {
      // read response
      const pstrlen = response.readUInt8(0) // pstrlen
      const pstr = Buffer.allocUnsafe(pstrlen)
      response.copy(pstr, 0, 1, pstrlen + 1) // pstr
      const reserved = Buffer.allocUnsafe(8)
      response.copy(reserved, 0, pstrlen + 1, pstrlen + 9) // reserved
      const infoHash = Buffer.allocUnsafe(20)
      response.copy(infoHash, 0, pstrlen + 9, pstrlen + 29) // infoHash
      const peerId = Buffer.allocUnsafe(20)
      response.copy(peerId, 0, pstrlen + 29, pstrlen + 49) // peerId

      return { pstr, reserved, infoHash, peerId }
    }
  }

  /// under the hood packet management ///

  _waitResponse(handshake = false) {
    return new Promise(resolve => {
      const handler = response => {
        console.log(`host: ${this._host} port: ${this._port} Received ${response.length}B, now ${this._buffer}B`)
        // handshake packet is not length-prefixed
        let len =
          this._buffer &&
          response.length > 4 && // minimum packet length
          (handshake
            ? this._buffer.readUInt8(0) + 49
            : this._buffer.readInt32BE(0) + 4)

        this._buffer = len
          ? this._buffer.concat([this._buffer, response])
          : response

        if (this._buffer.length >= len) {
          const packet = this._buffer.slice(0, len)
          this._buffer = this._buffer.slice(len)

          this._socket.removeListener('data', handler)
          resolve(packet)
        }
      }
      console.log('listener')
      this._socket.on('data', handler)
    })
  }

  catchErrorEvent(func) {
    return new Promise((resolve, reject) => {
      const handler = err => {
        this._socket.removeListener('error', handler)
        reject(err)
      }
      this._socket.once('error', handler)

      Promise.resolve(func())
        .then(ret => {
          this._socket.removeListener('error', handler)
          resolve(ret)
        })
        .catch(err => {
          this._socket.removeListener('error', handler)
          reject(err)
        })
    })
  }
}
