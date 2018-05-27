const dgram = require('dgram')
const parse = require('url')

module.exports.getPeers = async function(torrent) {
  const socket = dgram.createSocket('udp4')
  const url = torrent.announce.toString('utf8')

  await sendUdp(socket, connReq(), url)
  const message = awaitMessage(socket)
  console.log(message)
}

function sendUdp(socket, message, url) {
  const { port, hostname } = parse(url)

  return new Promise((resolve, reject) => {
    socket.send(message, port, hostname, err => {
      err ? reject(err) : resolve(message.length)
    })
  })
}

async function awaitMessage(socket) {
  return new Promise(resolve => socket.once('message', resolve))
}
