package uz.qurilishmollari.app;

import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.view.MotionEvent;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {

    private static final String SELLER_APP_STORE_URL =
        "https://play.google.com/store/apps/details?id=uz.qurilishmollari.seller";

    // Xaridorlar ilovasida "Sotuvchi bo'lish" havolasi bosilganda ichki sahifaga
    // o'tish o'rniga alohida "QM Seller" ilovasini yuklab olish taklif qilinadi.
    private static final String INTERCEPT_SELLER_LINKS_JS = """
        (function() {
          document.addEventListener('click', function(e) {
            var a = e.target.closest && e.target.closest('a[href*="seller.html"]');
            if (!a) return;
            e.preventDefault();
            e.stopPropagation();
            var goStore = confirm("Sotuvchi bo'lish uchun \\"QM Seller\\" ilovasini yuklab oling. Play Store'ga o'tasizmi?");
            if (goStore) {
              window.location.href = '%s';
            }
          }, true);
        })();
        """.formatted(SELLER_APP_STORE_URL);

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // target="_blank" havolalar (masalan, footer'dagi Telegram bot tugmalari)
        // WebView ichida jim o'tirib qolmasligi uchun tizim brauzerida ochiladi.
        WebView webView = getBridge().getWebView();
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);

        // Sahifa ochilgandan keyingi ENG BIRINCHI bosish ba'zan tugmani bosish
        // o'rniga faqat WebView'ga fokus berish uchun sarflanib qolar edi —
        // shuning uchun har bir bosishning eng boshida (ACTION_DOWN) fokusni
        // oldindan olib qo'yamiz, shunda bosishning o'zi ham darhol ishlaydi.
        webView.setOnTouchListener((v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_DOWN && !v.hasFocus()) {
                v.requestFocus();
            }
            return false;
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView.HitTestResult result = view.getHitTestResult();
                String url = result != null ? result.getExtra() : null;
                if (url != null) {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                }
                return false;
            }

            // Standart WebChromeClient JS confirm()'ni hech narsa ko'rsatmasdan
            // bekor qilib qo'yadi — shuning uchun uni haqiqiy native dialog bilan almashtiramiz.
            @Override
            public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                    .setMessage(message)
                    .setPositiveButton("Ha", (dialog, which) -> result.confirm())
                    .setNegativeButton("Yo'q", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel())
                    .show();
                return true;
            }
        });

        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                webView.evaluateJavascript(INTERCEPT_SELLER_LINKS_JS, null);
            }
        });
    }

    // Activity onCreate() vaqtida oyna hali tizimdan fokus olmagan bo'ladi —
    // shuning uchun webView.requestFocus() ni shu yerda chaqirish kerak, aks
    // holda foydalanuvchining BIRINCHI bosishi tugmani bosish o'rniga faqat
    // WebView'ga fokus berish uchun sarflanib, "hech narsa bo'lmadi" degan
    // taassurot qoldirar edi.
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            getBridge().getWebView().requestFocus();
        }
    }
}
