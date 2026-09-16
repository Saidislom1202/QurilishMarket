// Bu skript frontend/ papkasini FAQAT o'qiydi va nusxa oladi — u yerdagi fayllarga
// hech qanday o'zgartirish kiritilmaydi. Nusxa mobile-seller/www/ ichiga joylanadi
// va u yerda index.html seller.html'ga yo'naltiruvchi kichik sahifa bilan almashtiriladi,
// shunda "QM Seller" ilovasi to'g'ridan-to'g'ri sotuvchi oqimi bilan ochiladi.

const fs = require("fs");
const path = require("path");

const FRONTEND_DIR = path.join(__dirname, "..", "..", "frontend");
const WWW_DIR = path.join(__dirname, "..", "www");

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(WWW_DIR)) {
  fs.rmSync(WWW_DIR, { recursive: true, force: true });
}
copyRecursive(FRONTEND_DIR, WWW_DIR);

const redirectHtml = `<!doctype html>
<html lang="uz">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=seller.html">
  <script>location.replace('seller.html');</script>
</head>
<body></body>
</html>
`;
fs.writeFileSync(path.join(WWW_DIR, "index.html"), redirectHtml);

console.log("www/ tayyor: frontend/ dan nusxa olindi, index.html -> seller.html ga yo'naltiriladi.");
