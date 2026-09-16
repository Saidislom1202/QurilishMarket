import Capacitor
import WebKit

// Eslatma: iOS'da (Android'dan farqli o'laroq) target="_blank" havolalar,
// tashqi havolalar va JS confirm()/alert() muloqot oynalari Capacitor'ning
// o'zida allaqachon to'g'ri ishlaydi (Safari'da ochish, native dialog) —
// shuning uchun bu yerda faqat bizga xos qo'shimcha JS in'ektsiya qilinadi:
// xaridorlar ilovasida "Sotuvchi bo'lish" havolasi bosilganda ichki sahifaga
// o'tish o'rniga "QM Seller" ilovasini yuklab olish taklif qilinadi.
class MainViewController: CAPBridgeViewController {

    private static let sellerAppStoreURL = "https://apps.apple.com/app/idXXXXXXXXXX"

    private static let interceptSellerLinksJS = """
        (function() {
          document.addEventListener('click', function(e) {
            var a = e.target.closest && e.target.closest('a[href*="seller.html"]');
            if (!a) return;
            e.preventDefault();
            e.stopPropagation();
            var goStore = confirm("Sotuvchi bo'lish uchun \\"QM Seller\\" ilovasini yuklab oling. App Store'ga o'tasizmi?");
            if (goStore) {
              window.location.href = '\(sellerAppStoreURL)';
            }
          }, true);
        })();
        """

    override func capacitorDidLoad() {
        let script = WKUserScript(
            source: MainViewController.interceptSellerLinksJS,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        webView?.configuration.userContentController.addUserScript(script)
    }
}
