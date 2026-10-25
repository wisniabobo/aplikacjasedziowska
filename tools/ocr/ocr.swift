import Foundation
import Vision
import AppKit

// usage: ocr <out.json> <img1.png> [img2.png ...]
// Writes JSON: { "<img>": [ {"t": text, "x":, "y":, "w":, "h":, "c": conf} ... ] }  (normalized, y from top)
let args = CommandLine.arguments
guard args.count >= 3 else { FileHandle.standardError.write("usage\n".data(using: .utf8)!); exit(1) }
let outPath = args[1]
var result: [String: [[String: Any]]] = [:]
for path in args[2...] {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    req.revision = VNRecognizeTextRequestRevision3
    req.recognitionLanguages = ["pl-PL"]
    req.usesLanguageCorrection = true
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    do { try handler.perform([req]) } catch { continue }
    var lines: [[String: Any]] = []
    for obs in req.results ?? [] {
        guard let cand = obs.topCandidates(1).first else { continue }
        let b = obs.boundingBox
        lines.append(["t": cand.string, "x": b.minX, "y": 1.0 - b.maxY, "w": b.width, "h": b.height, "c": cand.confidence])
    }
    result[path] = lines
}
let data = try! JSONSerialization.data(withJSONObject: result, options: [])
try! data.write(to: URL(fileURLWithPath: outPath))
