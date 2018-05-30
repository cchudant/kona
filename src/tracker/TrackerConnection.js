const {
  genTransaction,
  connectWrite,
  connectRead,
  announceWrite,
  announceRead,
} = require('./protocol')
const { createSocket } = require('dgram')
const { parse } = require('url')
const EventEmitter = require('events')

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

  async connect({ timeout = 15000, trials = 8 } = {}) {
    this._socket = createSocket('udp4')

    // generate random transaction id
    const transactionId = genTransaction()

    const request = connectWrite({ transactionId })

    this._startMessageHandler()

    const { connectionId } = await new Promise((resolve, reject) => {
      this._tryConnect(request, transactionId, timeout, trials, (err, message) => {
        err ? reject(err) : resolve(message)
      })
    })

    this._connectionId = connectionId
    this._connected = true
  }

  _tryConnect(request, transaction, timeout, nmax, cb, n = 0) {
    console.log(this._socket)
    console.log(request, 0, request.length, Number(this.port), this.hostname)
    this._socket.send(request, 0, request.length, Number(this.port), this.hostname, err => {
      if (err) cb(new TrackerError(err))

      console.log('sent', request, 'n', n)

      this._startMessageHandler()

      let listener = null
      let retry = null

      if (n < nmax) { // don't retry after nmax trials

        // retry if no response
        retry = setTimeout(() => {
          this.removeListener('connectionResponse', listener)
          this._tryConnect(request, transaction, timeout, nmax, cb, n + 1)
        }, 2 ** n * timeout)

      } else {

        // no luck, they don't respond
        retry = setTimeout(() => {
          this.removeListener('connectionResponse', listener)
          cb(new TrackerError("Can't connect to host."))
        }, 15000)

      }

      listener = response => {
        // yay response!
        retry && clearTimeout(retry) // prevent retry from running

        console.log('received')

        if (response.transactionId === transaction)
          cb(null, response)
      }

      this.on('connectionResponse', listener)

    })
  }

  _startMessageHandler() {
    this._socket.on('message', buffer => {
      console.log(buffer)
      const action = buffer.readUInt32BE(0) // action
      const transactionId = buffer.readUInt32BE(4) // transaction_id

      switch (action) {
        case 0: {
          const connectionId = buffer.slice(8, 16) // connection_id
          this.emit('connectionResponse', {
            action,
            transactionId,
            connectionId
          })
        }
        case 1: {
        }
        case 2: {
        }
      }
    })
  }

  async announce(torrent, port = 6881) {
    const transaction = genTransaction()

    const request = connectWrite({ transactionId: transaction })
    await sendUdp(this._socket, request, this._hostname, this._port)

    const response = await awaitMessage(this._socket)
    const { transactionId, interval, leechers, seeders } = announceRead(
      response
    )

    if (transactionId !== transaction)
      throw new TrackerError('The transaction did not match')
  }
}

module.exports = TrackerConnection
