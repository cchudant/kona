module.exports = class BitField {
  constructor(buffer, length) {
    this.buffer = buffer
    this.length = length // Length in bits
  }

  get(bit) {
    return !!((this.buffer.readUInt8(~~(bit / 8)) >> bit % 8) & 1)
  }

  set(bit, val) {
    const byte = this.buffer.readUInt8(~~(bit / 8))
    this.buffer.writeUInt8(val ? byte | (1 << bit) : byte & ~(1 << bit), ~~(bit / 8))
  }

  toString() {
    return this.buffer.toString()
  }
}

// 69
// index 4
// byte 0 = 4/8
// 1000101
// 