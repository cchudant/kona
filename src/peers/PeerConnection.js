const { Socket } = require('net')
const EventEmitter = require('events')
const { pstr, peerId } = require('../protocolConstants')
const PeerError = require('./PeerError')
const BitField = require('./BitField')

const reserved = Buffer.alloc(8)

module.exports = class PeerConnection extends EventEmitter {
  constructor(host, port) {
    super()
    this._host = host
    this._port = port

    this._socket = new Socket()

    this._socket.setTimeout(3000)

    this.on('packet', p => {
      console.log(`${[...this._peerId].filter(c => c > 32 && c < 126).map(c => String.fromCharCode(c)).join('')}\t${this._host}:${this._port}\t<${[...p].map(d => d.toString(16).padStart(2, '0')).join(' ')}>`)
    })
  }

  connect({ infoHash, pieceLength }) {
    return this._catchErrorEvent(async () => {
      // connect
      await this._connect()
  
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
      
      this._peerId = recId
      this._pieceLength = pieceLength
      this._amChocking = true
      this._amInterested = false
      this._peerChoking = true
      this._peerInterested = false

      this._messageHandler()

      return this
    })
  }

  download() {

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

    request.writeUInt8(pstr.length, 0) // pstrlen
    pstr.copy(request, 1) // pstr
    reserved.copy(request, pstr.length + 1, 0, 8) // reserved
    infoHash.copy(request, pstr.length + 9, 0, 20) // info_hash
    peerId.copy(request, pstr.length + 29, 0, 20) // peer_id

    // write & wait for response
    this._socket.write(request)
    const response = await this._waitResponse(true)

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
        // handshake packet is not length-prefixed
        let len =
          this._buffer &&
          response.length > 4 && // minimum packet length
          (handshake
            ? this._buffer.readUInt8(0) + 49
            : this._buffer.readInt32BE(0) + 4)

        this._buffer = len
          ? Buffer.concat([this._buffer, response])
          : response

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

  _protocolChoke() {
    // write request
    const request = Buffer.allocUnsafe(5)

    request.writeUInt8(0, 4) // len
    request.writeUInt8(0, 1) // id

    // write
    this._socket.write(request)
  }

  _messageHandler() {
    this.on('_packet', buffer => {
      const id = buffer.readUInt8(0)

      const requireLength = (len, packet) => buffer.length < len && _error(new PeerError(`The packet length for ${packet} was invalid.`))

      switch (id) {
        case 0: { // choke
          this._peerChoking = true
          this.emit('choke', true)
          break
        }
        case 1: { // unchoke
          this._peerChoking = false
          this.emit('choke', false)
          break
        }
        case 2: { // interested
          this._peerInterested = true
          this.emit('interested', true)
          break
        }
        case 3: { // not interested
          this._peerInterested = false
          this.emit('interested', false)
          break
        }
        case 4: { // have
          requireLength(2, 'have')
          if (!this._bitfield) _error(new PeerError('A have packet was sent before bitfield packet'))
          const index = buffer.readUInt32BE(1)
          this._bitfield.set(index, true)
          this.emit('have', index)
          break
        }
        case 5: { // bitfield
          requireLength(0 /* todo length */, 'bitfield')
          this._bitfield = new BitField(buffer.slice(1), /* todo length */)
          this.emit('bitfield', this._bitfield)
          break
        }
      }
    })

    this._socket.on('data', data => {
      this._buffer = Buffer.concat([this._buffer, data])
      this._formPackets()
    })
    this._formPackets()
  }

  _formPackets() {
    while (this._buffer.length >= 4) {
      const size = this._buffer.readUInt32BE(0)
      if (size > this._buffer.length - 4)
        break // not enough received data

      if (size === 0) // keep alive packet
        continue

      const packet = this._buffer.slice(4, size + 4)
      this._buffer = this._buffer.slice(size + 4)
      
      this.emit('_packet', packet)
    }
  }

  _error(err) {
    if (!this.listenerCount('error'))
      throw err
    this.emit('error')
  }

  _catchErrorEvent(func) {
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
