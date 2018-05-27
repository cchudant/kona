const fs = require('fs')
const bencode = require('bencode')
const { parse: urlParse } = require('url')
const dgram = require('dgram')

const torrent = bencode.decode(fs.readFileSync('gimp-2.10.2-setup.exe.torrent'))

const announce = torrent.announce.toString()
const { port, hostname } = urlParse(announce)

const socket = dgram.createSocket('udp4')
const msg = Buffer.from('is anyone there?')
socket.send(msg, port, hostname, (...args) => {console.log(...args)})

socket.on('message', message => {
  console.log(message)
})