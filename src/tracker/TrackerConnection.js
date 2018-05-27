const {
  genTransaction,
  connectWrite,
  connectRead,
  sendUdp,
  awaitMessage
} = require('./protocol')
const { createSocket } = require('dgram')
const { parse } = require('url')

class TrackerConnection {
  constructor(url) {
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

  async connect(protocol = 'udp4') {
    this._socket = createSocket(protocol)

    const transaction = genTransaction()

    await sendUdp(this._socket, connectWrite(transaction), this._hostname, this._port)
    this._connectionId = connectRead(await awaitMessage(this._socket), transaction)

    this._connected = true
  }

  async announce() {}
}

module.exports = TrackerConnection