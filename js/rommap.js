// ROM mapping utilities (LoROM and HiROM support)
// This provides simple heuristics and mapping into the emulator Memory.

const ROMMap = {
  detectFormat(bytes) {
    // Look for SNES header at 0x7FC0 (LoROM) and 0xFFC0 (HiROM)
    const cand = [];
    if (bytes.length > 0x8000) {
      if (bytes.length > 0x8000 + 0x7fc0) cand.push({type: 'lorom', offset: 0x7fc0});
      if (bytes.length > 0xffc0) cand.push({type: 'hirom', offset: 0xffc0});
    }
    // prefer LoROM if title looks printable there
    for (const c of cand) {
      const title = ROMMap._readAscii(bytes, c.offset, 21);
      if (/[A-Za-z0-9]/.test(title)) return c.type;
    }
    // fallback by size heuristic: if size is multiple of 0x8000 and banks > 32 -> hirom
    const banks32k = Math.floor(bytes.length / 0x8000);
    if (banks32k >= 64) return 'hirom';
    return 'lorom';
  },

  _readAscii(bytes, offset, length) {
    let s = '';
    for (let i = 0; i < length; i++) {
      const b = bytes[offset + i];
      if (!b) break;
      s += (b >= 0x20 && b <= 0x7e) ? String.fromCharCode(b) : '.';
    }
    return s.replace(/\.+$/, '');
  },

  mapToMemory(mem, bytes, format) {
    // Map ROM bytes into the 24-bit memory according to LoROM or HiROM simple schemes.
    // This is a pragmatic mapper: maps 32KB banks for LoROM and 64KB banks for HiROM.
    if (format === 'lorom') {
      // LoROM: 32KB banks mapped to bank:0x008000-0x00FFFF, 0x018000-0x01FFFF, ...
      const bankSize = 0x8000;
      const banks = Math.ceil(bytes.length / bankSize);
      for (let b = 0; b < banks; b++) {
        const chunk = bytes.subarray(b * bankSize, Math.min((b + 1) * bankSize, bytes.length));
        const destAddr = (b << 16) | 0x8000; // bank b, offset 0x8000
        mem.loadAt(destAddr, chunk);
        // mirror into banks with high bit set (0x80 + b) for simple access from 0x80..0xFF
        const mirrorBank = (0x80 | b) & 0xFF;
        const mirrorAddr = (mirrorBank << 16) | 0x8000;
        mem.loadAt(mirrorAddr, chunk);
      }
      return {mappedBanks: banks, bankSize};
    } else {
      // HiROM: 64KB banks mapped to 0x0000-0xFFFF regions per bank
      const bankSize = 0x10000;
      const banks = Math.ceil(bytes.length / bankSize);
      for (let b = 0; b < banks; b++) {
        const chunk = bytes.subarray(b * bankSize, Math.min((b + 1) * bankSize, bytes.length));
        const destAddr = (b << 16) | 0x0000; // bank b, offset 0x0000
        mem.loadAt(destAddr, chunk);
        // mirror into 0x80+ bank region as well
        const mirrorBank = (0x80 | b) & 0xFF;
        const mirrorAddr = (mirrorBank << 16) | 0x0000;
        mem.loadAt(mirrorAddr, chunk);
      }
      return {mappedBanks: banks, bankSize};
    }
  }
};

window.ROMMap = ROMMap;
