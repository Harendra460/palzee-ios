import UIKit
import React
import ReactAppDependencyProvider
import Expo

public class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  public var window: UIWindow?

  public func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = (scene as? UIWindowScene) else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window

    if let appDelegate = UIApplication.shared.delegate as? AppDelegate,
       let factory = appDelegate.reactNativeFactory {
      factory.startReactNative(
        withModuleName: "main",
        in: window,
        launchOptions: nil
      )
    }

    window.makeKeyAndVisible()
  }

  public func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    _ = RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }

  public func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
