// Minimal S-PPU shim: framebuffer and VRAM write handling for demo/visualization
class PPU {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = 256; // SNES nominal screen width (we keep this simple)
    this.height = 224; // typical SNES height
    this.vram = new Uint8Array(64 * 1024); // small VRAM buffer for demo
    this.framebuffer = new Uint8ClampedArray(this.width * this.height * 4);
    this.ctx = this.canvas.getContext('2d');
    this.imageData = this.ctx.createImageData(this.width, this.height);
    this.dirty = false;
  }

  writeVram(offset, value) {
    offset = offset & (this.vram.length - 1);
    this.vram[offset] = value & 0xFF;
    // For demo purposes: map VRAM sequential bytes to pixels
    const px = offset % (this.width * this.height);
    const base = px * 4;
    this.framebuffer[base+0] = value; // R
    this.framebuffer[base+1] = value; // G
    this.framebuffer[base+2] = value; // B
    this.framebuffer[base+3] = 0xFF;  // A
    this.dirty = true;
  }

  renderToCanvas() {
    if (!this.dirty) return;
    // copy framebuffer to imageData
    this.imageData.data.set(this.framebuffer);
    this.ctx.putImageData(this.imageData, 0, 0);
    this.dirty = false;
  }
}

window.PPU = PPU;
