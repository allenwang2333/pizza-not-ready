// Renders the app icon set: a pizza emoji on an orange rounded square.
// Usage: swift make-icon.swift <output.iconset>
import AppKit

let out = URL(fileURLWithPath: CommandLine.arguments[1])
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)

func render(_ px: Int) -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: px, pixelsHigh: px, bitsPerSample: 8,
                               samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                               colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let s = CGFloat(px), inset = s * 0.1
    let rect = NSRect(x: inset, y: inset, width: s - inset * 2, height: s - inset * 2)
    NSColor(red: 0.99, green: 0.62, blue: 0.26, alpha: 1).setFill()
    NSBezierPath(roundedRect: rect, xRadius: s * 0.18, yRadius: s * 0.18).fill()
    let emoji = NSAttributedString(string: "🍕", attributes: [.font: NSFont.systemFont(ofSize: s * 0.55)])
    let size = emoji.size()
    emoji.draw(at: NSPoint(x: (s - size.width) / 2, y: (s - size.height) / 2))
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}

for base in [16, 32, 128, 256, 512] {
    try render(base).write(to: out.appendingPathComponent("icon_\(base)x\(base).png"))
    try render(base * 2).write(to: out.appendingPathComponent("icon_\(base)x\(base)@2x.png"))
}
