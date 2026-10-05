import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Khoá ký bản phát hành (task 7.2) — đọc từ android/key.properties (KHÔNG commit:
// .gitignore đã chặn key.properties và *.jks). Cách tạo: App/README.md, mục
// "Phát hành Android". Chưa có file thì bản release tạm ký bằng debug key để vẫn
// build / cài thử được — bản đó KHÔNG dùng để phát hành.
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) FileInputStream(keystorePropertiesFile).use { load(it) }
}
val hasReleaseKey = keystorePropertiesFile.exists()

android {
    namespace = "vn.danang.smartcity.smart_city_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // Khoá định danh VĨNH VIỄN trên Play Store — đã publish thì không đổi được,
        // và là khoá của Firebase app (B2) + OAuth client ID (B4). Phase 0.0b.
        applicationId = "vn.danang.smartcity.smart_city_app"
        // flutter_secure_storage (Keystore) cần API 23+.
        minSdk = maxOf(flutter.minSdkVersion, 23)
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            // Có key.properties → ký bằng khoá phát hành; chưa có → debug key (chỉ để thử).
            // Đổi khoá ký nghĩa là đổi chữ ký app: cài đè lên bản cũ phải gỡ bản cũ
            // trước, và SHA-1 mới phải được thêm vào OAuth client Android (Google Sign-In).
            signingConfig = signingConfigs.getByName(if (hasReleaseKey) "release" else "debug")
        }
    }
}

flutter {
    source = "../.."
}
