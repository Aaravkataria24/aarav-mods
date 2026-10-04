// clackd: a tiny low-latency sound player. Preloads every sound under a folder, then plays
// one per request on a Unix socket: `GET /play/<pack>/<press|release>/<NAME>?gain=0.8`.
// One request per keystroke; a pool of player nodes lets sounds overlap like real typing.
import AVFoundation
import Foundation

let args = CommandLine.arguments
guard args.count >= 3 else { FileHandle.standardError.write("usage: clackd <sounds-dir> <socket-path>\n".data(using: .utf8)!); exit(2) }
let soundsDir = URL(fileURLWithPath: args[1])
let socketPath = args[2]

let engine = AVAudioEngine()
let mixer = engine.mainMixerNode
var buffers: [String: AVAudioPCMBuffer] = [:]
var format: AVAudioFormat?

// Load every audio file, converting to one shared format so all players can share a connection.
let fm = FileManager.default
if let e = fm.enumerator(at: soundsDir, includingPropertiesForKeys: nil) {
  for case let url as URL in e where ["mp3", "wav", "caf", "m4a"].contains(url.pathExtension.lowercased()) {
    guard let file = try? AVAudioFile(forReading: url) else { continue }
    let target = format ?? AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2)!
    format = target
    guard let src = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)) else { continue }
    try? file.read(into: src)
    guard let conv = AVAudioConverter(from: file.processingFormat, to: target) else { continue }
    let ratio = target.sampleRate / file.processingFormat.sampleRate
    guard let out = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: AVAudioFrameCount(Double(src.frameLength) * ratio) + 1024) else { continue }
    var fed = false
    conv.convert(to: out, error: nil) { _, status in
      if fed { status.pointee = .noDataNow; return nil }
      fed = true; status.pointee = .haveData; return src
    }
    let key = url.path.replacingOccurrences(of: soundsDir.path + "/", with: "")
      .replacingOccurrences(of: "." + url.pathExtension, with: "")
    buffers[key] = out
  }
}

let fmt = format ?? AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 2)!
let players: [AVAudioPlayerNode] = (0..<24).map { _ in
  let p = AVAudioPlayerNode(); engine.attach(p); engine.connect(p, to: mixer, format: fmt); return p
}
do { try engine.start() } catch { FileHandle.standardError.write("engine: \(error)\n".data(using: .utf8)!); exit(1) }
players.forEach { $0.play() }
var next = 0

// Packs without a dedicated SPACE/ENTER/BACKSPACE recording fall back to a row sound.
func resolve(_ key: String) -> AVAudioPCMBuffer? {
  if let b = buffers[key] { return b }
  let parts = key.split(separator: "/")
  guard parts.count == 3 else { return nil }
  let (pack, kind, name) = (parts[0], parts[1], parts[2])
  let fallback = kind == "release" ? "GENERIC" : (name == "SPACE" ? "GENERIC_R4" : "GENERIC_R2")
  return buffers["\(pack)/\(kind)/\(fallback)"]
}

// CLACKD_LOG=<file> appends every sound played (for testing without listening).
let logPath = ProcessInfo.processInfo.environment["CLACKD_LOG"]
let logHandle: FileHandle? = logPath.flatMap { path in
  FileManager.default.createFile(atPath: path, contents: nil)
  return FileHandle(forWritingAtPath: path)
}

func play(_ key: String, gain: Float) -> Bool {
  guard let buf = resolve(key) else { return false }
  logHandle?.write("\(Date().timeIntervalSince1970) \(key) \(gain)\n".data(using: .utf8)!)
  let p = players[next]; next = (next + 1) % players.count
  p.volume = gain
  p.scheduleBuffer(buf, at: nil, options: .interrupts, completionHandler: nil)
  return true
}

// ---- a minimal HTTP server on a Unix socket ----
unlink(socketPath)
let fd = socket(AF_UNIX, SOCK_STREAM, 0)
var addr = sockaddr_un(); addr.sun_family = sa_family_t(AF_UNIX)
_ = withUnsafeMutablePointer(to: &addr.sun_path) { ptr in
  socketPath.withCString { strncpy(UnsafeMutableRawPointer(ptr).assumingMemoryBound(to: CChar.self), $0, 103) }
}
let bound = withUnsafePointer(to: &addr) { $0.withMemoryRebound(to: sockaddr.self, capacity: 1) { bind(fd, $0, socklen_t(MemoryLayout<sockaddr_un>.size)) } }
guard bound == 0, listen(fd, 64) == 0 else { FileHandle.standardError.write("bind failed\n".data(using: .utf8)!); exit(1) }
print("clackd ready: \(buffers.count) sounds"); fflush(stdout)

// Exit with the parent (the Claude Code session) so nothing lingers.
let parent = getppid()
Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { _ in if getppid() != parent || kill(parent, 0) != 0 { unlink(socketPath); exit(0) } }

DispatchQueue.global().async {
  var buf = [UInt8](repeating: 0, count: 2048)
  while true {
    let c = accept(fd, nil, nil); if c < 0 { continue }
    let n = read(c, &buf, buf.count)
    var status = "404 Not Found"
    if n > 0, let req = String(bytes: buf[0..<n], encoding: .utf8), let line = req.split(separator: "\r\n").first {
      let parts = line.split(separator: " ")
      if parts.count >= 2, parts[1].hasPrefix("/play/") {
        let full = String(parts[1].dropFirst(6))
        let pieces = full.split(separator: "?", maxSplits: 1)
        let key = String(pieces[0]).removingPercentEncoding ?? String(pieces[0])
        var gain: Float = 1
        if pieces.count > 1, let g = pieces[1].split(separator: "=").last, let v = Float(g) { gain = max(0, min(2, v)) }
        let ok = DispatchQueue.main.sync { play(key, gain: gain) }
        status = ok ? "204 No Content" : "404 Not Found"
      } else if parts.count >= 2, parts[1] == "/ping" { status = "204 No Content" }
    }
    let resp = "HTTP/1.1 \(status)\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
    _ = resp.withCString { write(c, $0, strlen($0)) }
    close(c)
  }
}
RunLoop.main.run()
