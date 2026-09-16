package uz.qurilishmollari.seller;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.provider.MediaStore;
import android.view.MotionEvent;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends BridgeActivity {

    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraPhotoUri;
    private ActivityResultLauncher<Intent> fileChooserLauncher;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        fileChooserLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (filePathCallback == null) return;
                Uri[] results = null;
                if (result.getResultCode() == RESULT_OK) {
                    Intent data = result.getData();
                    if (data != null && data.getData() != null) {
                        results = new Uri[]{data.getData()};
                    } else if (cameraPhotoUri != null) {
                        results = new Uri[]{cameraPhotoUri};
                    }
                }
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
                cameraPhotoUri = null;
            }
        );

        super.onCreate(savedInstanceState);

        // target="_blank" havolalar (masalan, "Admin bilan bog'lanish" Telegram tugmasi)
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

            // Standart Android WebView <input type="file"> bosilganda hech narsa
            // qilmaydi — galereya/kamera tanlash oynasini o'zimiz ochishimiz kerak.
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;
                cameraPhotoUri = null;

                Intent galleryIntent = new Intent(Intent.ACTION_GET_CONTENT);
                galleryIntent.addCategory(Intent.CATEGORY_OPENABLE);
                galleryIntent.setType("image/*");

                Intent chooserIntent = Intent.createChooser(galleryIntent, "Mahsulot rasmini tanlang");

                if (getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
                    Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    if (cameraIntent.resolveActivity(getPackageManager()) != null) {
                        try {
                            File photoFile = File.createTempFile(
                                "photo_" + new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date()),
                                ".jpg",
                                getCacheDir()
                            );
                            cameraPhotoUri = FileProvider.getUriForFile(
                                MainActivity.this, getPackageName() + ".fileprovider", photoFile
                            );
                            cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);
                            chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                        } catch (IOException ignored) {
                            // Kamera fayli tayyorlanmasa, faqat galereya bilan davom etamiz.
                        }
                    }
                }

                fileChooserLauncher.launch(chooserIntent);
                return true;
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
