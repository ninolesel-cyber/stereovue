// Stereo Vue for the Mac: a native window around the Stereo Vue page, served
// by a bundled Node server on this machine. No browser, no address bar.
import AppKit
import UniformTypeIdentifiers
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate,
  WKScriptMessageHandler, WKDownloadDelegate, NSWindowDelegate
{
  var window: NSWindow!
  var webView: WKWebView!
  var server: Process?
  var port = 0
  var downloadNames: [ObjectIdentifier: String] = [:]

  func applicationDidFinishLaunching(_ notification: Notification) {
    buildMenu()
    buildWindow()
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        let port = try self.startServer()
        DispatchQueue.main.async {
          self.port = port
          self.webView.load(URLRequest(url: URL(string: "http://127.0.0.1:\(port)/")!))
        }
      } catch {
        DispatchQueue.main.async { self.fail(error.localizedDescription) }
      }
    }
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

  func applicationWillTerminate(_ notification: Notification) {
    server?.terminate()
  }

  // MARK: Server

  func freePort() -> Int {
    for candidate in 47_310..<47_400 {
      let fd = socket(AF_INET, SOCK_STREAM, 0)
      defer { close(fd) }
      var yes: Int32 = 1
      setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &yes, socklen_t(MemoryLayout<Int32>.size))
      var addr = sockaddr_in()
      addr.sin_family = sa_family_t(AF_INET)
      addr.sin_port = in_port_t(UInt16(candidate).bigEndian)
      addr.sin_addr.s_addr = inet_addr("127.0.0.1")
      let ok = withUnsafePointer(to: &addr) {
        $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
          Darwin.bind(fd, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) == 0
        }
      }
      if ok { return candidate }
    }
    return 47_399
  }

  func startServer() throws -> Int {
    let res = Bundle.main.resourceURL!
    // Usually the same port each launch, so the page keeps its saved data
    // (the downloaded relief model) between launches.
    let port = freePort()
    let logs = FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Library/Logs/Stereo Vue", isDirectory: true)
    try? FileManager.default.createDirectory(at: logs, withIntermediateDirectories: true)
    let logURL = logs.appendingPathComponent("server.log")
    FileManager.default.createFile(atPath: logURL.path, contents: nil)
    let log = try FileHandle(forWritingTo: logURL)

    let p = Process()
    p.executableURL = res.appendingPathComponent("node")
    p.arguments = ["server/index.mjs"]
    p.currentDirectoryURL = res.appendingPathComponent("server")
    var env = ProcessInfo.processInfo.environment
    env["PORT"] = String(port)
    env["HOST"] = "127.0.0.1"
    env["NODE_ENV"] = "production"
    env["VITE_AUTH_ENABLED"] = "false"
    p.environment = env
    p.standardOutput = log
    p.standardError = log
    try p.run()
    server = p

    let url = URL(string: "http://127.0.0.1:\(port)/")!
    for _ in 0..<120 {
      if !p.isRunning { break }
      let sem = DispatchSemaphore(value: 0)
      var up = false
      URLSession.shared.dataTask(with: url) { _, resp, _ in
        up = (resp as? HTTPURLResponse)?.statusCode == 200
        sem.signal()
      }.resume()
      _ = sem.wait(timeout: .now() + 2)
      if up { return port }
      Thread.sleep(forTimeInterval: 0.25)
    }
    throw NSError(
      domain: "StereoVue", code: 1,
      userInfo: [NSLocalizedDescriptionKey: "The instrument could not be started. Details are in \(logURL.path)"])
  }

  func fail(_ message: String) {
    let alert = NSAlert()
    alert.messageText = "Stereo Vue could not start"
    alert.informativeText = message
    alert.runModal()
    NSApp.terminate(nil)
  }

  // MARK: Window

  func buildWindow() {
    let config = WKWebViewConfiguration()
    config.websiteDataStore = .default()
    config.userContentController.add(self, name: "stereoVue")
    config.preferences.setValue(true, forKey: "developerExtrasEnabled")
    webView = WKWebView(frame: .zero, configuration: config)
    webView.navigationDelegate = self
    webView.uiDelegate = self
    webView.setValue(false, forKey: "drawsBackground")

    window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 880, height: 960),
      styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
      backing: .buffered, defer: false)
    window.title = "Stereo Vue"
    window.titlebarAppearsTransparent = true
    window.backgroundColor = NSColor(red: 0.11, green: 0.08, blue: 0.055, alpha: 1)
    window.minSize = NSSize(width: 420, height: 620)
    window.contentView = webView
    window.delegate = self
    window.setFrameAutosaveName("StereoVueMain")
    if window.frame.origin == .zero { window.center() }
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  func buildMenu() {
    let main = NSMenu()
    let appItem = NSMenuItem()
    main.addItem(appItem)
    let appMenu = NSMenu()
    appMenu.addItem(withTitle: "About Stereo Vue", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "Hide Stereo Vue", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
    appMenu.addItem(.separator())
    appMenu.addItem(withTitle: "Quit Stereo Vue", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    appItem.submenu = appMenu

    let editItem = NSMenuItem()
    main.addItem(editItem)
    let edit = NSMenu(title: "Edit")
    edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
    edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
    edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
    edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
    editItem.submenu = edit

    let viewItem = NSMenuItem()
    main.addItem(viewItem)
    let view = NSMenu(title: "View")
    view.addItem(withTitle: "Reload", action: #selector(reloadPage), keyEquivalent: "r")
    view.addItem(withTitle: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
    viewItem.submenu = view

    let windowItem = NSMenuItem()
    main.addItem(windowItem)
    let win = NSMenu(title: "Window")
    win.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
    win.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
    windowItem.submenu = win
    NSApp.windowsMenu = win
    NSApp.mainMenu = main
  }

  @objc func reloadPage() { webView.reload() }

  // MARK: Page bridge (save dialog and share menu)

  func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
    guard let body = message.body as? [String: Any],
      let action = body["action"] as? String,
      let name = body["filename"] as? String,
      let dataURL = body["data"] as? String,
      let comma = dataURL.firstIndex(of: ","),
      let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...]))
    else { return }
    if action == "share" { share(data, name: name) } else { save(data, name: name) }
  }

  func save(_ data: Data, name: String) {
    let panel = NSSavePanel()
    panel.nameFieldStringValue = name
    panel.directoryURL = FileManager.default.urls(for: .picturesDirectory, in: .userDomainMask).first
    panel.canCreateDirectories = true
    panel.beginSheetModal(for: window) { response in
      guard response == .OK, let url = panel.url else { return }
      do { try data.write(to: url) } catch { NSAlert(error: error).runModal() }
    }
  }

  func share(_ data: Data, name: String) {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
    try? data.write(to: url)
    let picker = NSSharingServicePicker(items: [url])
    let point = window.mouseLocationOutsideOfEventStream
    let anchor = webView.convert(point, from: nil)
    picker.show(relativeTo: NSRect(x: anchor.x, y: anchor.y, width: 1, height: 1), of: webView, preferredEdge: .minY)
  }

  // MARK: Navigation and downloads

  func webView(
    _ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
  ) {
    if action.shouldPerformDownload {
      decisionHandler(.download)
      return
    }
    if let url = action.request.url, let host = url.host, host != "127.0.0.1",
      action.navigationType == .linkActivated
    {
      NSWorkspace.shared.open(url)
      decisionHandler(.cancel)
      return
    }
    decisionHandler(.allow)
  }

  func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
    download.delegate = self
  }

  func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
    download.delegate = self
  }

  func download(
    _ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String,
    completionHandler: @escaping (URL?) -> Void
  ) {
    let panel = NSSavePanel()
    panel.nameFieldStringValue = suggestedFilename
    panel.directoryURL = FileManager.default.urls(for: .picturesDirectory, in: .userDomainMask).first
    panel.beginSheetModal(for: window) { r in
      guard r == .OK, let url = panel.url else { return completionHandler(nil) }
      try? FileManager.default.removeItem(at: url)
      completionHandler(url)
    }
  }

  func webView(
    _ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
    for action: WKNavigationAction, windowFeatures: WKWindowFeatures
  ) -> WKWebView? {
    if let url = action.request.url { NSWorkspace.shared.open(url) }
    return nil
  }

  // <input type="file">
  func webView(
    _ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
    initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void
  ) {
    let panel = NSOpenPanel()
    panel.allowsMultipleSelection = parameters.allowsMultipleSelection
    panel.canChooseDirectories = false
    panel.allowedContentTypes = [.image]
    panel.directoryURL = FileManager.default.urls(for: .picturesDirectory, in: .userDomainMask).first
    panel.beginSheetModal(for: window) { r in completionHandler(r == .OK ? panel.urls : nil) }
  }

  func webView(
    _ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
    initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
    decisionHandler: @escaping (WKPermissionDecision) -> Void
  ) {
    decisionHandler(origin.host == "127.0.0.1" ? .grant : .deny)
  }

  func webView(
    _ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
    initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void
  ) {
    let alert = NSAlert()
    alert.messageText = message
    alert.beginSheetModal(for: window) { _ in completionHandler() }
  }

  // Self-check used when building: STEREOVUE_TEST_JS runs a script in the page,
  // then STEREOVUE_SNAPSHOT saves a picture of the window. Off otherwise.
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    let env = ProcessInfo.processInfo.environment
    guard let shot = env["STEREOVUE_SNAPSHOT"] else { return }
    let script = env["STEREOVUE_TEST_JS"].flatMap { try? String(contentsOfFile: $0, encoding: .utf8) }
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
      let finish = {
        webView.takeSnapshot(with: nil) { image, _ in
          if let tiff = image?.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
            let png = rep.representation(using: .png, properties: [:])
          {
            try? png.write(to: URL(fileURLWithPath: shot))
          }
        }
      }
      if let script {
        webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { result in
          let text: String
          switch result {
          case .success(let v): text = String(describing: v)
          case .failure(let e): text = "ERROR " + String(describing: e)
          }
          try? text.write(toFile: shot + ".txt", atomically: true, encoding: .utf8)
          finish()
        }
      } else {
        finish()
      }
    }
  }

  func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
