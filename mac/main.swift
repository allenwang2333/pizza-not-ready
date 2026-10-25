import Cocoa
import WebKit

// WKWebView passes unhandled keys up the responder chain, which makes the window beep.
final class GameWindow: NSWindow {
    override func noResponder(for eventSelector: Selector) {
        if eventSelector == #selector(NSResponder.keyDown(with:)) { return }
        super.noResponder(for: eventSelector)
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
    var window: GameWindow!
    var web: WKWebView!
    var floatItem: NSMenuItem!
    var miniItem: NSMenuItem!
    var normalFrame: NSRect?

    let saveURL: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("PizzaReady", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("save.json")
    }()

    func applicationDidFinishLaunching(_ notification: Notification) {
        let content = WKUserContentController()
        content.add(self, name: "save")
        content.add(self, name: "badge")
        if let saved = try? String(contentsOf: saveURL, encoding: .utf8), !saved.isEmpty,
           let literal = try? JSONSerialization.data(withJSONObject: saved, options: .fragmentsAllowed),
           let js = String(data: literal, encoding: .utf8) {
            content.addUserScript(WKUserScript(source: "window.__SAVE__ = \(js);",
                                               injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        let config = WKWebViewConfiguration()
        config.userContentController = content
        config.mediaTypesRequiringUserActionForPlayback = []
        web = WKWebView(frame: .zero, configuration: config)

        window = GameWindow(contentRect: NSRect(x: 0, y: 0, width: 960, height: 660),
                            styleMask: [.titled, .closable, .miniaturizable, .resizable],
                            backing: .buffered, defer: false)
        window.title = "Pizza Ready"
        window.contentMinSize = NSSize(width: 360, height: 240)
        window.contentView = web
        window.center()
        window.setFrameAutosaveName("PizzaReadyMain")
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(web)

        let page = Bundle.main.url(forResource: "index", withExtension: "html")!
        web.loadFileURL(page, allowingReadAccessTo: page.deletingLastPathComponent())

        buildMenu()
        if UserDefaults.standard.bool(forKey: "keepOnTop") { setFloating(true) }
        NSApp.activate(ignoringOtherApps: true)
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "save", let data = message.body as? String {
            try? data.write(to: saveURL, atomically: true, encoding: .utf8)
        }
        // Cash waiting in the shop, shown on the Dock icon while the window is in the background.
        if message.name == "badge", let text = message.body as? String {
            NSApp.dockTile.badgeLabel = text.isEmpty ? nil : text
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    // Write one last save before quitting.
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        web.evaluateJavaScript("(window.__game.S.t = Date.now(), JSON.stringify(window.__game.S))") { result, _ in
            if let data = result as? String { try? data.write(to: self.saveURL, atomically: true, encoding: .utf8) }
            NSApp.reply(toApplicationShouldTerminate: true)
        }
        return .terminateLater
    }

    @objc func toggleFloat(_ sender: Any?) { setFloating(window.level != .floating) }

    // Small window in the bottom-right corner, always on top. Toggle again to restore.
    @objc func toggleMini(_ sender: Any?) {
        if let frame = normalFrame {
            normalFrame = nil
            window.setFrame(frame, display: true, animate: true)
            let keep = UserDefaults.standard.bool(forKey: "keepOnTop")
            window.level = keep ? .floating : .normal
            window.collectionBehavior = keep ? [.canJoinAllSpaces, .fullScreenAuxiliary] : []
            miniItem.state = .off
        } else {
            normalFrame = window.frame
            let area = (window.screen ?? NSScreen.main)?.visibleFrame ?? window.frame
            let size = NSSize(width: 440, height: 300)
            window.setFrame(NSRect(x: area.maxX - size.width - 16, y: area.minY + 16,
                                   width: size.width, height: size.height), display: true, animate: true)
            window.level = .floating
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            miniItem.state = .on
        }
    }

    func setFloating(_ on: Bool) {
        window.level = on ? .floating : .normal
        window.collectionBehavior = on ? [.canJoinAllSpaces, .fullScreenAuxiliary] : []
        floatItem.state = on ? .on : .off
        UserDefaults.standard.set(on, forKey: "keepOnTop")
    }

    func buildMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        main.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Pizza Ready", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide Pizza Ready", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(withTitle: "Quit Pizza Ready", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        let winItem = NSMenuItem()
        main.addItem(winItem)
        let winMenu = NSMenu(title: "Window")
        floatItem = winMenu.addItem(withTitle: "Keep on Top", action: #selector(toggleFloat(_:)), keyEquivalent: "t")
        floatItem.target = self
        miniItem = winMenu.addItem(withTitle: "Mini Mode", action: #selector(toggleMini(_:)), keyEquivalent: "m")
        miniItem.keyEquivalentModifierMask = [.command, .option]
        miniItem.target = self
        winMenu.addItem(.separator())
        winMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        winMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        winItem.submenu = winMenu
        NSApp.mainMenu = main
        NSApp.windowsMenu = winMenu
    }
}

MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.regular)
    app.run()
}
